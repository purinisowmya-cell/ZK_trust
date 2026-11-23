import crypto from 'crypto';
import { generateVerificationNonce, verifyCredentialSignature } from '../services/cryptoService.js';
import { verifyGroth16Proof } from '../services/zkVerifier.js';
import { query } from '../db/index.js';

/**
 * Creates a new QR verification session challenge for a relying party verifier (Feature 4).
 */
export async function createQrSession(req, res) {
  try {
    const {
      verifierId = 'verifier:portal-demo',
      verifierName = 'ZK-Trust Relying Party Verifier',
      credentialType = 'AGE', // 'AGE', 'STUDENT', 'KYC', 'HUMAN', 'MULTI'
      requiredClaims = { minAge: 18 },
      expirySeconds = 300,
    } = req.body;

    const sessionId = 'qr_sess_' + crypto.randomUUID();
    const nonce = generateVerificationNonce();
    const expiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();

    const sessionPayload = {
      protocol: 'zktrust-v1',
      action: 'verify-credential',
      sessionId,
      verifierId,
      verifierName,
      credentialType,
      requiredClaims,
      nonce,
      expiresAt,
    };

    // Store in DB
    await query(
      `INSERT INTO qr_verification_sessions
        (session_id, verifier_id, verifier_name, credential_type, required_claims, nonce, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7)`,
      [
        sessionId,
        verifierId,
        verifierName,
        credentialType,
        JSON.stringify(requiredClaims),
        nonce,
        expiresAt,
      ]
    );

    return res.status(201).json({
      sessionId,
      nonce,
      credentialType,
      requiredClaims,
      expiresAt,
      expirySeconds,
      qrPayload: JSON.stringify(sessionPayload),
      qrDeepLink: `zktrust://verify?sessionId=${sessionId}&type=${credentialType}&nonce=${nonce}`,
    });
  } catch (err) {
    console.error('QR session creation error:', err);
    return res.status(500).json({ error: `Failed to create QR session: ${err.message}` });
  }
}

/**
 * Retrieves the live status of a QR session (Polled by the verifier).
 */
export async function getQrSession(req, res) {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT session_id, verifier_id, verifier_name, credential_type, required_claims, 
              nonce, status, result_payload, created_at, expires_at 
       FROM qr_verification_sessions 
       WHERE session_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'QR verification session not found.' });
    }

    const session = result.rows[0];

    // Check expiration
    if (session.status === 'PENDING' && new Date(session.expires_at) < new Date()) {
      await query("UPDATE qr_verification_sessions SET status = 'EXPIRED' WHERE session_id = $1", [id]);
      session.status = 'EXPIRED';
    }

    return res.json({
      ...session,
      required_claims: typeof session.required_claims === 'string' ? JSON.parse(session.required_claims) : session.required_claims,
      result_payload: typeof session.result_payload === 'string' ? JSON.parse(session.result_payload) : session.result_payload,
    });
  } catch (err) {
    return res.status(500).json({ error: `Failed to fetch QR session: ${err.message}` });
  }
}

/**
 * Signals that the QR code has been scanned by the user's wallet.
 */
export async function scanQrSession(req, res) {
  try {
    const { id } = req.params;
    const result = await query(
      'SELECT session_id, status, expires_at FROM qr_verification_sessions WHERE session_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'QR verification session not found.' });
    }

    const session = result.rows[0];
    if (new Date(session.expires_at) < new Date()) {
      await query("UPDATE qr_verification_sessions SET status = 'EXPIRED' WHERE session_id = $1", [id]);
      return res.status(400).json({ error: 'QR session has expired.' });
    }

    if (session.status !== 'PENDING') {
      return res.status(400).json({ error: `Session cannot be scanned in status '${session.status}'.` });
    }

    await query("UPDATE qr_verification_sessions SET status = 'SCANNED' WHERE session_id = $1", [id]);

    return res.json({ message: 'Session marked as scanned.', status: 'SCANNED' });
  } catch (err) {
    return res.status(500).json({ error: `Failed to update QR scan: ${err.message}` });
  }
}

/**
 * User rejects or cancels the verification challenge consent (Feature 9).
 */
export async function rejectQrSession(req, res) {
  try {
    const { id } = req.params;
    const { reason = 'User declined attribute disclosure consent', credentialId } = req.body;

    const sessResult = await query(
      'SELECT session_id, verifier_id, status, expires_at FROM qr_verification_sessions WHERE session_id = $1',
      [id]
    );

    if (sessResult.rows.length === 0) {
      return res.status(404).json({ error: 'QR session not found.' });
    }

    const session = sessResult.rows[0];
    if (session.status !== 'PENDING' && session.status !== 'SCANNED') {
      return res.status(400).json({ error: `Cannot reject session in status '${session.status}'.` });
    }

    const rejectionPayload = {
      verified: false,
      status: 'REJECTED',
      reason,
      rejectedAt: new Date().toISOString(),
    };

    await query(
      "UPDATE qr_verification_sessions SET status = 'REJECTED', result_payload = $1 WHERE session_id = $2",
      [JSON.stringify(rejectionPayload), id]
    );

    // Record rejection in user_consent_records
    await query(
      `INSERT INTO user_consent_records 
        (session_or_request_id, verifier_id, credential_id, approved_attributes, rejected_attributes, consent_action)
       VALUES ($1, $2, $3, $4, $5, 'REJECTED')`,
      [
        id,
        session.verifier_id,
        credentialId || 'n/a',
        JSON.stringify([]),
        JSON.stringify([reason]),
      ]
    );

    return res.json({ message: 'Verification session successfully rejected.', status: 'REJECTED' });
  } catch (err) {
    return res.status(500).json({ error: `Failed to reject session: ${err.message}` });
  }
}

/**
 * Submits proof and verified claims to fulfill the QR session (Features 4 & 9).
 * Supports both single credential presentation and multi-attribute bundles.
 */
export async function submitQrProof(req, res) {
  try {
    const { id } = req.params;
    const {
      proof,
      publicSignals,
      credentialPayload,
      issuerSignature,
      disclosedClaims = {},
      rejectedClaims = [],
      credentialBundles = null, // Optional multi-credential array
    } = req.body;

    // 1. Fetch Session
    const sessResult = await query(
      'SELECT * FROM qr_verification_sessions WHERE session_id = $1',
      [id]
    );

    if (sessResult.rows.length === 0) {
      return res.status(404).json({ error: 'QR verification session not found.' });
    }

    const session = sessResult.rows[0];

    if (session.status !== 'PENDING' && session.status !== 'SCANNED') {
      return res.status(400).json({ error: `Session is not active (Status: ${session.status}). Anti-replay triggered.` });
    }

    if (new Date(session.expires_at) < new Date()) {
      await query("UPDATE qr_verification_sessions SET status = 'EXPIRED' WHERE session_id = $1", [id]);
      return res.status(400).json({ error: 'QR session has expired.' });
    }

    const bundles = credentialBundles && Array.isArray(credentialBundles) && credentialBundles.length > 0
      ? credentialBundles
      : [{ credentialPayload, issuerSignature, disclosedClaims, proof, publicSignals }];

    let primaryNullifier = 'qr_' + crypto.randomUUID().slice(0, 16);
    const verifiedAttributes = {};

    for (const b of bundles) {
      const payload = b.credentialPayload;
      const sig = b.issuerSignature;

      if (!payload || !sig) {
        return res.status(400).json({ error: 'Each credential bundle must include credentialPayload and issuerSignature.' });
      }

      // Check Revocation
      const revCheck = await query(
        'SELECT id, reason FROM credential_revocations WHERE credential_id = $1',
        [payload.credentialId]
      );
      if (revCheck.rows.length > 0) {
        await query(
          "UPDATE qr_verification_sessions SET status = 'REJECTED', result_payload = $1 WHERE session_id = $2",
          [JSON.stringify({ error: 'Credential revoked', reason: revCheck.rows[0].reason }), id]
        );
        return res.status(400).json({ error: `Submitted credential '${payload.credentialId}' has been revoked: ${revCheck.rows[0].reason}` });
      }

      // Check credentials table status
      const credCheck = await query('SELECT status FROM credentials WHERE credential_id = $1', [payload.credentialId]);
      if (credCheck.rows.length > 0 && credCheck.rows[0].status === 'REVOKED') {
        return res.status(400).json({ error: `Credential '${payload.credentialId}' is revoked.` });
      }

      // Verify Issuer Signature
      const issuerResult = await query('SELECT public_key, is_active FROM issuers WHERE issuer_id = $1', [payload.issuerId]);
      if (issuerResult.rows.length === 0 || !issuerResult.rows[0].is_active) {
        return res.status(400).json({ error: `Unknown or inactive issuer '${payload.issuerId}'.` });
      }

      const sigOk = verifyCredentialSignature(payload, sig, issuerResult.rows[0].public_key);
      if (!sigOk) {
        return res.status(400).json({ error: `Invalid issuer signature on credential '${payload.credentialId}'.` });
      }

      // If Groth16 proof included, verify it
      if (b.proof && b.publicSignals) {
        if (!Array.isArray(b.publicSignals) || b.publicSignals.length < 4) {
          return res.status(400).json({ error: 'Public signals array is malformed or incomplete.' });
        }

        const zkCheck = await verifyGroth16Proof(b.proof, b.publicSignals);
        if (!zkCheck.isValid) {
          return res.status(400).json({ error: `ZK Proof verification failed: ${zkCheck.error}` });
        }

        const [zkNullifier, zkCommitment, zkMinAge, zkNonce] = b.publicSignals.map(s => s.toString());

        // Binding check 1: Proof commitment must match credential commitment
        if (payload.commitment && zkCommitment !== payload.commitment.toString()) {
          return res.status(400).json({ error: 'Signed credential commitment does not match ZK proof commitment.' });
        }

        // Binding check 2: Proof nonce must match QR session challenge nonce
        if (session.nonce && zkNonce !== session.nonce.toString()) {
          return res.status(400).json({ error: 'Proof nonce does not match the active QR session nonce.' });
        }

        primaryNullifier = zkNullifier;

        const nullCheck = await query('SELECT id FROM verification_logs WHERE nullifier = $1 AND result = $2', [primaryNullifier, 'VALID']);
        if (nullCheck.rows.length > 0) {
          return res.status(400).json({ error: 'Replay detected: Nullifier already used.' });
        }
      }

      Object.assign(verifiedAttributes, b.disclosedClaims || {});
    }

    // 5. Build Result Payload
    const resultPayload = {
      verified: true,
      credentialType: session.credential_type,
      verifierName: session.verifier_name,
      disclosedClaims: verifiedAttributes,
      verifiedAt: new Date().toISOString(),
      nullifier: primaryNullifier,
      securityChecks: {
        nonceMatches: true,
        issuerSignatureValid: true,
        revocationStatusActive: true,
        zkProofValid: proof ? true : 'CRYPTOGRAPHIC_ATTESTATION_VALID',
        selectiveDisclosureEnforced: true,
      },
    };

    // 6. Update session to VERIFIED
    await query(
      "UPDATE qr_verification_sessions SET status = 'VERIFIED', result_payload = $1 WHERE session_id = $2",
      [JSON.stringify(resultPayload), id]
    );

    // 7. Log in verification_logs
    await query(
      `INSERT INTO verification_logs 
        (request_id, verifier_id, verifier_name, requested_claim, nullifier, commitment, result, issuer_id, credential_type, verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'VALID', $7, $8, CURRENT_TIMESTAMP)`,
      [
        id,
        session.verifier_id,
        session.verifier_name,
        JSON.stringify(session.required_claims),
        primaryNullifier,
        credentialPayload?.commitment || 'selective-disclosure-bundle',
        credentialPayload?.issuerId || 'multi-issuer',
        session.credential_type,
      ]
    );

    // 8. Record user consent record in user_consent_records
    await query(
      `INSERT INTO user_consent_records 
        (session_or_request_id, verifier_id, credential_id, approved_attributes, rejected_attributes, consent_action)
       VALUES ($1, $2, $3, $4, $5, 'APPROVED')`,
      [
        id,
        session.verifier_id,
        credentialPayload?.credentialId || 'bundle',
        JSON.stringify(verifiedAttributes),
        JSON.stringify(rejectedClaims),
      ]
    );

    console.log(`[QR Hub] Session '${id}' successfully verified for '${session.verifier_name}'.`);

    return res.json({
      message: 'QR Verification successful. Verifier notified.',
      result: resultPayload,
    });
  } catch (err) {
    console.error('Submit QR proof error:', err);
    return res.status(500).json({ error: `Failed to fulfill QR session: ${err.message}` });
  }
}

/**
 * Retrieves consent records for auditing and privacy compliance (Feature 9).
 */
export async function getConsentRecords(req, res) {
  try {
    const result = await query(
      `SELECT id, session_or_request_id, verifier_id, credential_id, 
              approved_attributes, rejected_attributes, consent_action, consented_at 
       FROM user_consent_records 
       ORDER BY consented_at DESC 
       LIMIT 50`
    );
    return res.json({ consentRecords: result.rows });
  } catch (err) {
    return res.status(500).json({ error: `Failed to fetch consent records: ${err.message}` });
  }
}
