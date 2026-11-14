import crypto from 'crypto';
import {
  poseidonHash,
  generateRandomSecret,
  signCredentialPayload,
} from '../services/cryptoService.js';
import { getIssuerKeyPair } from '../services/issuerKeyManager.js';
import { query } from '../db/index.js';
import { config } from '../config/index.js';

/**
 * Retrieves the trusted demo issuer's public profile and Ed25519 public key.
 */
export async function getIssuerProfile(req, res) {
  try {
    const keys = getIssuerKeyPair();
    const result = await query(
      'SELECT issuer_id, name, public_key, is_active FROM issuers WHERE issuer_id = $1',
      [config.issuer.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Issuer not registered.' });
    }

    return res.json({
      issuerId: result.rows[0].issuer_id,
      name: result.rows[0].name,
      publicKey: keys.publicKey,
      isActive: result.rows[0].is_active,
    });
  } catch (err) {
    return res.status(500).json({ error: `Failed to fetch issuer: ${err.message}` });
  }
}

/**
 * Issues a synthetic identity credential.
 * Calculates Poseidon commitment, signs with Ed25519, saves commitment to DB,
 * and returns the credential and private witness data to the client wallet.
 */
export async function issueCredential(req, res) {
  try {
    let { age, dateOfBirth, fullName, secret } = req.body;

    // Calculate age if dateOfBirth is given, or validate integer age
    if (age === undefined || age === null || isNaN(Number(age))) {
      if (dateOfBirth) {
        const dob = new Date(dateOfBirth);
        if (isNaN(dob.getTime())) {
          return res.status(400).json({ error: 'Invalid date of birth provided.' });
        }
        const diffMs = Date.now() - dob.getTime();
        const ageDt = new Date(diffMs);
        age = Math.abs(ageDt.getUTCFullYear() - 1970);
      } else {
        return res.status(400).json({ error: 'Must provide either age or dateOfBirth.' });
      }
    } else {
      age = parseInt(age, 10);
    }

    if (age < 0 || age > 150) {
      return res.status(400).json({ error: 'Age must be between 0 and 150.' });
    }

    // Generate or use user-provided BN254 secret
    const credentialSecret = secret ? secret.toString() : generateRandomSecret();

    // 1. Compute cryptographic Poseidon commitment: Poseidon(age, secret)
    const commitment = await poseidonHash([age, credentialSecret]);

    const credentialId = 'cred_' + crypto.randomUUID();
    const issuedAt = new Date().toISOString();
    // Expiration: 1 year from now
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const canonicalPayload = {
      credentialId,
      issuerId: config.issuer.id,
      commitment,
      issuedAt,
      expiresAt,
    };

    // 2. Sign canonical payload with Issuer Ed25519 private key
    const keys = getIssuerKeyPair();
    const issuerSignature = signCredentialPayload(canonicalPayload, keys.privateKey);

    // 3. Store ONLY public metadata in registry (NEVER save age or secret)
    await query(
      `INSERT INTO credentials 
        (credential_id, issuer_id, commitment, issued_at, expires_at, status, issuer_signature)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6)`,
      [credentialId, config.issuer.id, commitment, issuedAt, expiresAt, issuerSignature]
    );

    console.log(`[Issuer] Credential issued: ${credentialId} (Commitment: ${commitment.slice(0, 12)}...)`);

    // 4. Return signed credential to user wallet along with private witness data
    return res.status(201).json({
      message: 'Credential successfully issued.',
      credential: {
        credentialId,
        issuerId: config.issuer.id,
        commitment,
        issuedAt,
        expiresAt,
        status: 'ACTIVE',
        issuerSignature,
      },
      // Private data returned ONLY to the wallet for local witness generation
      privateData: {
        age,
        secret: credentialSecret,
        fullName: fullName || 'Demo Citizen',
        dateOfBirth: dateOfBirth || null,
      },
    });
  } catch (err) {
    console.error('Credential issuance error:', err);
    return res.status(500).json({ error: `Credential issuance failed: ${err.message}` });
  }
}

/**
 * Checks the status of an existing credential (ACTIVE / REVOKED / EXPIRED).
 */
export async function getCredentialStatus(req, res) {
  try {
    const { id } = req.params;
    const result = await query(
      'SELECT credential_id, issuer_id, status, issued_at, expires_at FROM credentials WHERE credential_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Credential not found.' });
    }

    const cred = result.rows[0];
    const isExpired = new Date(cred.expires_at) < new Date();
    const effectiveStatus = isExpired ? 'EXPIRED' : cred.status;

    return res.json({
      credentialId: cred.credential_id,
      issuerId: cred.issuer_id,
      status: effectiveStatus,
      issuedAt: cred.issued_at,
      expiresAt: cred.expires_at,
    });
  } catch (err) {
    return res.status(500).json({ error: `Failed to check credential: ${err.message}` });
  }
}
