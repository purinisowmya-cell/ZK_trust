import crypto from 'crypto';
import {
  poseidonHash,
  generateRandomSecret,
  signCredentialPayload,
  hashStringToField,
} from '../services/cryptoService.js';
import { getIssuerKeyPair } from '../services/issuerKeyManager.js';
import { query } from '../db/index.js';
import { config } from '../config/index.js';

/**
 * Retrieves an issuer's public profile and Ed25519 public key.
 */
export async function getIssuerProfile(req, res) {
  try {
    const issuerId = req.query.issuerId || config.issuer.id;
    const keys = getIssuerKeyPair(issuerId);
    const result = await query(
      `SELECT i.issuer_id, i.name, i.issuer_type, i.public_key, i.is_active, i.description, i.onchain_address,
              o.name as org_name, o.website as org_website
       FROM issuers i
       LEFT JOIN organizations o ON i.org_id = o.org_id
       WHERE i.issuer_id = $1`,
      [issuerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Issuer '${issuerId}' not registered.` });
    }

    const row = result.rows[0];
    return res.json({
      issuerId: row.issuer_id,
      name: row.name,
      orgName: row.org_name,
      issuerType: row.issuer_type,
      publicKey: keys.publicKey,
      isActive: row.is_active,
      description: row.description,
      onchainAddress: row.onchain_address,
    });
  } catch (err) {
    return res.status(500).json({ error: `Failed to fetch issuer: ${err.message}` });
  }
}

/**
 * Issues an Age identity credential.
 */
export async function issueCredential(req, res) {
  try {
    let { age, dateOfBirth, fullName, secret, issuerId } = req.body;
    const targetIssuerId = issuerId || config.issuer.id;

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

    const credentialSecret = secret ? secret.toString() : generateRandomSecret();
    const commitment = await poseidonHash([age, credentialSecret]);

    const credentialId = 'cred_age_' + crypto.randomUUID();
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const canonicalPayload = {
      credentialId,
      issuerId: targetIssuerId,
      commitment,
      issuedAt,
      expiresAt,
    };

    const keys = getIssuerKeyPair(targetIssuerId);
    const issuerSignature = signCredentialPayload(canonicalPayload, keys.privateKey);

    await query(
      `INSERT INTO credentials 
        (credential_id, issuer_id, credential_type, commitment, issued_at, expires_at, status, issuer_signature)
       VALUES ($1, $2, 'AGE', $3, $4, $5, 'ACTIVE', $6)`,
      [credentialId, targetIssuerId, commitment, issuedAt, expiresAt, issuerSignature]
    );

    return res.status(201).json({
      message: 'Age credential successfully issued.',
      credential: {
        credentialId,
        issuerId: targetIssuerId,
        credentialType: 'AGE',
        commitment,
        issuedAt,
        expiresAt,
        status: 'ACTIVE',
        issuerSignature,
      },
      privateData: {
        age,
        secret: credentialSecret,
        fullName: fullName || 'Demo Citizen',
        dateOfBirth: dateOfBirth || null,
      },
    });
  } catch (err) {
    console.error('Age credential issuance error:', err);
    return res.status(500).json({ error: `Credential issuance failed: ${err.message}` });
  }
}

/**
 * Issues a verified Student Credential (Feature 1).
 */
export async function issueStudentCredential(req, res) {
  try {
    const {
      studentId = 'STU-' + Math.floor(100000 + Math.random() * 900000),
      fullName = 'Alex Morgan',
      collegeName = 'Massachusetts Institute of Technology',
      department = 'Computer Science and Artificial Intelligence',
      course = 'B.S. in Computer Science',
      graduationYear = 2027,
      enrollmentStatus = 'ENROLLED',
      issuerId = 'did:zktrust:issuer:mit-edu',
      secret,
    } = req.body;

    const credentialSecret = secret ? secret.toString() : generateRandomSecret();

    // Compute composite student attribute hash: sha256(studentId + department + course + gradYear)
    const compositeString = `${studentId}|${collegeName}|${department}|${course}|${graduationYear}|${enrollmentStatus}`;
    const studentAttrHash = hashStringToField(compositeString);

    // Compute cryptographic Poseidon commitment
    const commitment = await poseidonHash([studentAttrHash, credentialSecret]);

    const credentialId = 'cred_stu_' + crypto.randomUUID();
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const canonicalPayload = {
      credentialId,
      issuerId,
      commitment,
      issuedAt,
      expiresAt,
    };

    const keys = getIssuerKeyPair(issuerId);
    const issuerSignature = signCredentialPayload(canonicalPayload, keys.privateKey);

    // Store in credentials table
    await query(
      `INSERT INTO credentials 
        (credential_id, issuer_id, credential_type, commitment, issued_at, expires_at, status, issuer_signature)
       VALUES ($1, $2, 'STUDENT', $3, $4, $5, 'ACTIVE', $6)`,
      [credentialId, issuerId, commitment, issuedAt, expiresAt, issuerSignature]
    );

    // Store student specific details
    const studentIdHash = hashStringToField(studentId);
    await query(
      `INSERT INTO student_credentials
        (credential_id, institution_id, student_id_hash, department, course, graduation_year, enrollment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [credentialId, issuerId, studentIdHash, department, course, parseInt(graduationYear, 10), enrollmentStatus]
    );

    console.log(`[Student Issuer] Credential issued for ${studentId} at ${collegeName}`);

    return res.status(201).json({
      message: 'Student credential successfully issued.',
      credential: {
        credentialId,
        issuerId,
        credentialType: 'STUDENT',
        collegeName,
        department,
        course,
        graduationYear: parseInt(graduationYear, 10),
        enrollmentStatus,
        commitment,
        issuedAt,
        expiresAt,
        status: 'ACTIVE',
        issuerSignature,
      },
      privateData: {
        studentId,
        fullName,
        collegeName,
        department,
        course,
        graduationYear: parseInt(graduationYear, 10),
        enrollmentStatus,
        studentAttrHash,
        secret: credentialSecret,
      },
    });
  } catch (err) {
    console.error('Student credential error:', err);
    return res.status(500).json({ error: `Student credential issuance failed: ${err.message}` });
  }
}

/**
 * Issues a Privacy-Preserving KYC Credential (Feature 3).
 */
export async function issueKycCredential(req, res) {
  try {
    const {
      fullName = 'Demo Citizen',
      kycTier = 2, // 1: Basic ID, 2: Enhanced AML/Address, 3: Full Enterprise Biometric
      jurisdiction = 'US',
      idType = 'PASSPORT',
      verificationStandard = 'ISO-30107-3',
      issuerId = 'did:zktrust:issuer:trust-kyc',
      secret,
    } = req.body;

    const validatedTier = Math.min(Math.max(parseInt(kycTier, 10) || 1, 1), 3);
    const credentialSecret = secret ? secret.toString() : generateRandomSecret();

    // Poseidon commitment over KYC Tier and secret
    const commitment = await poseidonHash([validatedTier, credentialSecret]);

    const credentialId = 'cred_kyc_' + crypto.randomUUID();
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const canonicalPayload = {
      credentialId,
      issuerId,
      commitment,
      issuedAt,
      expiresAt,
    };

    const keys = getIssuerKeyPair(issuerId);
    const issuerSignature = signCredentialPayload(canonicalPayload, keys.privateKey);

    await query(
      `INSERT INTO credentials 
        (credential_id, issuer_id, credential_type, commitment, issued_at, expires_at, status, issuer_signature)
       VALUES ($1, $2, 'KYC', $3, $4, $5, 'ACTIVE', $6)`,
      [credentialId, issuerId, commitment, issuedAt, expiresAt, issuerSignature]
    );

    const idTypeHash = hashStringToField(idType + ':' + crypto.randomUUID());
    await query(
      `INSERT INTO kyc_credentials
        (credential_id, provider_id, kyc_tier, jurisdiction, id_type_hash, verification_standard)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [credentialId, issuerId, validatedTier, jurisdiction, idTypeHash, verificationStandard]
    );

    return res.status(201).json({
      message: 'Privacy-preserving KYC credential issued.',
      credential: {
        credentialId,
        issuerId,
        credentialType: 'KYC',
        kycTier: validatedTier,
        jurisdiction,
        verificationStandard,
        commitment,
        issuedAt,
        expiresAt,
        status: 'ACTIVE',
        issuerSignature,
      },
      privateData: {
        fullName,
        kycTier: validatedTier,
        jurisdiction,
        idType,
        secret: credentialSecret,
      },
    });
  } catch (err) {
    console.error('KYC issuance error:', err);
    return res.status(500).json({ error: `KYC issuance failed: ${err.message}` });
  }
}

/**
 * Issues a Proof of Human Sybil-Resistant Credential (Feature 8).
 */
export async function issueHumanCredential(req, res) {
  try {
    const {
      fullName = 'Human User',
      livenessScore = 98.7,
      sybilResistanceLevel = 'HIGH',
      issuerId = 'did:zktrust:issuer:human-id',
      secret,
    } = req.body;

    const validatedScore = parseFloat(livenessScore) || 95.0;
    const credentialSecret = secret ? secret.toString() : generateRandomSecret();

    // Scale score to integer for field element
    const scaledScore = Math.floor(validatedScore * 100);
    const commitment = await poseidonHash([scaledScore, credentialSecret]);

    const credentialId = 'cred_hum_' + crypto.randomUUID();
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

    const canonicalPayload = {
      credentialId,
      issuerId,
      commitment,
      issuedAt,
      expiresAt,
    };

    const keys = getIssuerKeyPair(issuerId);
    const issuerSignature = signCredentialPayload(canonicalPayload, keys.privateKey);

    await query(
      `INSERT INTO credentials 
        (credential_id, issuer_id, credential_type, commitment, issued_at, expires_at, status, issuer_signature)
       VALUES ($1, $2, 'HUMAN', $3, $4, $5, 'ACTIVE', $6)`,
      [credentialId, issuerId, commitment, issuedAt, expiresAt, issuerSignature]
    );

    await query(
      `INSERT INTO human_credentials
        (credential_id, attester_id, liveness_score, sybil_resistance_level)
       VALUES ($1, $2, $3, $4)`,
      [credentialId, issuerId, validatedScore, sybilResistanceLevel]
    );

    return res.status(201).json({
      message: 'Proof of Human attestation credential issued.',
      credential: {
        credentialId,
        issuerId,
        credentialType: 'HUMAN',
        livenessScore: validatedScore,
        sybilResistanceLevel,
        commitment,
        issuedAt,
        expiresAt,
        status: 'ACTIVE',
        issuerSignature,
      },
      privateData: {
        fullName,
        livenessScore: validatedScore,
        sybilResistanceLevel,
        secret: credentialSecret,
      },
    });
  } catch (err) {
    console.error('Human attestation error:', err);
    return res.status(500).json({ error: `Human credential issuance failed: ${err.message}` });
  }
}

/**
 * Checks the status of an existing credential.
 */
export async function getCredentialStatus(req, res) {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT c.credential_id, c.issuer_id, c.credential_type, c.status, c.issued_at, c.expires_at,
              r.reason as revocation_reason, r.revoked_at
       FROM credentials c
       LEFT JOIN credential_revocations r ON c.credential_id = r.credential_id
       WHERE c.credential_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Credential not found.' });
    }

    const cred = result.rows[0];
    const isRevoked = cred.status === 'REVOKED' || !!cred.revocation_reason;
    const isExpired = new Date(cred.expires_at) < new Date();
    const effectiveStatus = isRevoked ? 'REVOKED' : isExpired ? 'EXPIRED' : cred.status;

    return res.json({
      credentialId: cred.credential_id,
      issuerId: cred.issuer_id,
      credentialType: cred.credential_type,
      status: effectiveStatus,
      isRevoked,
      isExpired,
      revocationReason: cred.revocation_reason || null,
      issuedAt: cred.issued_at,
      expiresAt: cred.expires_at,
    });
  } catch (err) {
    return res.status(500).json({ error: `Failed to check credential: ${err.message}` });
  }
}

/**
 * Lists all issued credentials for an issuer.
 */
export async function listCredentials(req, res) {
  try {
    const { issuerId, credentialType } = req.query;
    let queryText = `
      SELECT c.credential_id, c.issuer_id, c.credential_type, c.status, c.issued_at, c.expires_at,
             i.name as issuer_name,
             r.reason as revocation_reason, r.revoked_at
      FROM credentials c
      LEFT JOIN issuers i ON c.issuer_id = i.issuer_id
      LEFT JOIN credential_revocations r ON c.credential_id = r.credential_id
      WHERE 1=1
    `;
    const params = [];

    if (issuerId) {
      params.push(issuerId);
      queryText += ` AND c.issuer_id = $${params.length}`;
    }

    if (credentialType) {
      params.push(credentialType);
      queryText += ` AND c.credential_type = $${params.length}`;
    }

    queryText += ` ORDER BY c.issued_at DESC LIMIT 100`;

    const result = await query(queryText, params);
    return res.json({ credentials: result.rows });
  } catch (err) {
    return res.status(500).json({ error: `Failed to list credentials: ${err.message}` });
  }
}
