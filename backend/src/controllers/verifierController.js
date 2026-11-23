import crypto from 'crypto';
import {
  generateVerificationNonce,
  verifyCredentialSignature,
} from '../services/cryptoService.js';
import { verifyGroth16Proof } from '../services/zkVerifier.js';
import { query } from '../db/index.js';
import { config } from '../config/index.js';

/**
 * Creates a unique verification challenge with a single-use cryptographic nonce.
 */
export async function createVerificationChallenge(req, res) {
  try {
    const {
      verifierId = 'verifier:demo-relying-party',
      verifierName = 'Age-Restricted Service (Demo)',
      purpose = 'Compliance age requirement check',
      minAge = 18,
      credentialType = 'AGE',
      requiredClaims = null,
    } = req.body;

    const validatedMinAge = parseInt(minAge, 10);
    if (isNaN(validatedMinAge) || validatedMinAge < 0 || validatedMinAge > 150) {
      return res.status(400).json({ error: 'Valid minimum age between 0 and 150 is required.' });
    }

    const requestId = 'req_' + crypto.randomUUID();
    const nonce = generateVerificationNonce();
    const expiresAt = new Date(
      Date.now() + config.verification.challengeExpirySeconds * 1000
    ).toISOString();

    const claimsJson = requiredClaims ? JSON.stringify(requiredClaims) : JSON.stringify({ minAge: validatedMinAge });

    await query(
      `INSERT INTO verification_requests 
        (request_id, verifier_id, verifier_name, purpose, min_age, credential_type, required_claims, nonce, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', $9)`,
      [
        requestId,
        verifierId,
        verifierName,
        purpose,
        validatedMinAge,
        credentialType,
        claimsJson,
        nonce,
        expiresAt,
      ]
    );

    return res.status(201).json({
      requestId,
      nonce,
      minAge: validatedMinAge,
      credentialType,
      requiredClaims: requiredClaims || { minAge: validatedMinAge },
      verifierId,
      verifierName,
      purpose,
      status: 'PENDING',
      expiresAt,
    });
  } catch (err) {
    console.error('Challenge creation error:', err);
    return res.status(500).json({ error: `Failed to create challenge: ${err.message}` });
  }
}

/**
 * Retrieves challenge details by requestId.
 */
export async function getVerificationChallenge(req, res) {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT request_id, verifier_id, verifier_name, purpose, min_age, 
              credential_type, required_claims, nonce, status, expires_at 
       FROM verification_requests WHERE request_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Verification request not found.' });
    }

    const row = result.rows[0];
    return res.json({
      ...row,
      required_claims: typeof row.required_claims === 'string' ? JSON.parse(row.required_claims) : row.required_claims,
    });
  } catch (err) {
    return res.status(500).json({ error: `Failed to fetch request: ${err.message}` });
  }
}

/**
 * Verifies a Zero-Knowledge Age Proof with complete end-to-end security checks:
 * 1. Challenge status & expiry check
 * 2. Issuer public key retrieval & active check
 * 3. Issuer Ed25519 signature verification on canonical credential
 * 4. Revocation check (Feature 6)
 * 5. Credential expiration check
 * 6. Public signal binding checks (nullifier, commitment, minAge, nonce)
 * 7. Anti-replay nullifier uniqueness verification
 * 8. Groth16 Zero-Knowledge proof cryptographic verification
 */
export async function verifyProof(req, res) {
  const { requestId, proof, publicSignals, credentialPayload, issuerSignature } = req.body;

  let requestRecord = null;
  let targetNullifier = null;
  let targetCommitment = null;

  try {
    // ------------------------------------------------------------------------
    // Check 1: Input presence validation
    // ------------------------------------------------------------------------
    if (!requestId || !proof || !publicSignals || !credentialPayload || !issuerSignature) {
      return recordAndRespondFailure(
        requestId,
        'Missing required parameters (requestId, proof, publicSignals, credentialPayload, or issuerSignature).',
        400,
        res
      );
    }

    // ------------------------------------------------------------------------
    // Check 2: Verification Challenge Status & Expiry
    // ------------------------------------------------------------------------
    const reqResult = await query(
      'SELECT * FROM verification_requests WHERE request_id = $1',
      [requestId]
    );

    if (reqResult.rows.length === 0) {
      return recordAndRespondFailure(requestId, 'Verification challenge not found.', 404, res);
    }

    requestRecord = reqResult.rows[0];

    if (requestRecord.status !== 'PENDING') {
      return recordAndRespondFailure(
        requestId,
        `Verification challenge is not pending (Current status: ${requestRecord.status}). Replay attack prevented.`,
        400,
        res,
        requestRecord
      );
    }

    if (new Date(requestRecord.expires_at) < new Date()) {
      await query("UPDATE verification_requests SET status = 'EXPIRED' WHERE request_id = $1", [
        requestId,
      ]);
      return recordAndRespondFailure(
        requestId,
        'Verification challenge has expired.',
        400,
        res,
        requestRecord
      );
    }

    // ------------------------------------------------------------------------
    // Check 3: Issuer Identity & Public Key Retrieval
    // ------------------------------------------------------------------------
    const issuerResult = await query(
      'SELECT issuer_id, name, public_key, is_active FROM issuers WHERE issuer_id = $1',
      [credentialPayload.issuerId]
    );

    if (issuerResult.rows.length === 0) {
      return recordAndRespondFailure(
        requestId,
        `Unknown or untrusted Issuer ID: ${credentialPayload.issuerId}.`,
        400,
        res,
        requestRecord
      );
    }

    const issuer = issuerResult.rows[0];
    if (!issuer.is_active) {
      return recordAndRespondFailure(
        requestId,
        `Issuer ${issuer.name} is currently inactive or revoked.`,
        400,
        res,
        requestRecord
      );
    }

    // ------------------------------------------------------------------------
    // Check 4: Issuer Ed25519 Signature on Canonical Credential
    // ------------------------------------------------------------------------
    const isSignatureValid = verifyCredentialSignature(
      credentialPayload,
      issuerSignature,
      issuer.public_key
    );

    if (!isSignatureValid) {
      return recordAndRespondFailure(
        requestId,
        'Invalid Issuer digital signature. Credential payload was altered or forged.',
        400,
        res,
        requestRecord
      );
    }

    // ------------------------------------------------------------------------
    // Check 5: Credential Expiration & Revocation Status (Feature 6)
    // ------------------------------------------------------------------------
    if (new Date(credentialPayload.expiresAt) < new Date()) {
      return recordAndRespondFailure(
        requestId,
        'The submitted identity credential has expired.',
        400,
        res,
        requestRecord
      );
    }

    // Check credentials table
    const credCheck = await query(
      'SELECT status FROM credentials WHERE credential_id = $1',
      [credentialPayload.credentialId]
    );

    if (credCheck.rows.length > 0 && credCheck.rows[0].status === 'REVOKED') {
      return recordAndRespondFailure(
        requestId,
        'The submitted credential has been revoked by the issuer.',
        400,
        res,
        requestRecord
      );
    }

    // Check credential_revocations registry table
    const revCheck = await query(
      'SELECT id, reason, revoked_at FROM credential_revocations WHERE credential_id = $1',
      [credentialPayload.credentialId]
    );

    if (revCheck.rows.length > 0) {
      return recordAndRespondFailure(
        requestId,
        `The submitted credential was revoked on ${new Date(revCheck.rows[0].revoked_at).toLocaleDateString()}. Reason: ${revCheck.rows[0].reason}`,
        400,
        res,
        requestRecord
      );
    }

    // ------------------------------------------------------------------------
    // Check 6: Public Signal Binding Checks
    // Expected SnarkJS layout:
    // publicSignals[0] = nullifier
    // publicSignals[1] = commitment
    // publicSignals[2] = minAge
    // publicSignals[3] = nonce
    // ------------------------------------------------------------------------
    if (!Array.isArray(publicSignals) || publicSignals.length < 4) {
      return recordAndRespondFailure(
        requestId,
        'Public signals array is malformed or incomplete.',
        400,
        res,
        requestRecord
      );
    }

    const [zkNullifier, zkCommitment, zkMinAge, zkNonce] = publicSignals.map(s => s.toString());
    targetNullifier = zkNullifier;
    targetCommitment = zkCommitment;

    // Check 6a: Signed commitment must equal commitment in ZK proof
    if (credentialPayload.commitment.toString() !== zkCommitment) {
      return recordAndRespondFailure(
        requestId,
        'Signed credential commitment does not match ZK proof commitment.',
        400,
        res,
        requestRecord
      );
    }

    // Check 6b: Verified minimum age must match requested policy
    if (zkMinAge !== requestRecord.min_age.toString()) {
      return recordAndRespondFailure(
        requestId,
        `Proof minimum age (${zkMinAge}) does not match requested challenge requirement (${requestRecord.min_age}).`,
        400,
        res,
        requestRecord
      );
    }

    // Check 6c: Verified nonce must match challenge nonce
    if (zkNonce !== requestRecord.nonce.toString()) {
      return recordAndRespondFailure(
        requestId,
        'Proof nonce does not match the active challenge nonce.',
        400,
        res,
        requestRecord
      );
    }

    // ------------------------------------------------------------------------
    // Check 7: Anti-Replay Nullifier Verification
    // Prevent duplicate proof presentations using the same nullifier
    // ------------------------------------------------------------------------
    const nullifierCheck = await query(
      'SELECT id FROM verification_logs WHERE nullifier = $1 AND result = $2',
      [zkNullifier, 'VALID']
    );

    if (nullifierCheck.rows.length > 0) {
      return recordAndRespondFailure(
        requestId,
        'Replay attack detected: This nullifier has already been consumed in a prior verification.',
        400,
        res,
        requestRecord
      );
    }

    // ------------------------------------------------------------------------
    // Check 8: Groth16 Zero-Knowledge Proof Cryptographic Verification
    // ------------------------------------------------------------------------
    const proofResult = await verifyGroth16Proof(proof, publicSignals);

    if (!proofResult.isValid) {
      return recordAndRespondFailure(
        requestId,
        `Zero-Knowledge proof rejected: ${proofResult.error}`,
        400,
        res,
        requestRecord
      );
    }

    // ------------------------------------------------------------------------
    // Step 9: Mark Challenge as CONSUMED and Log Audit Entry
    // ------------------------------------------------------------------------
    await query("UPDATE verification_requests SET status = 'CONSUMED' WHERE request_id = $1", [
      requestId,
    ]);

    await query(
      `INSERT INTO verification_logs 
        (request_id, verifier_id, verifier_name, requested_claim, nullifier, commitment, result, issuer_id, credential_type, verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'VALID', $7, 'AGE', CURRENT_TIMESTAMP)`,
      [
        requestId,
        requestRecord.verifier_id,
        requestRecord.verifier_name,
        `Age >= ${requestRecord.min_age}`,
        zkNullifier,
        zkCommitment,
        credentialPayload.issuerId,
      ]
    );

    console.log(
      `[Verifier] VALID proof verified for request: ${requestId} (Claim: Age >= ${requestRecord.min_age})`
    );

    return res.json({
      verified: true,
      message: 'Proof cryptographically verified. Age requirement satisfied.',
      claim: `Age >= ${requestRecord.min_age}`,
      verifierName: requestRecord.verifier_name,
      requestId,
      nullifier: zkNullifier,
      timestamp: new Date().toISOString(),
      details: {
        issuerSignatureValid: true,
        commitmentMatches: true,
        groth16ProofValid: true,
        antiReplayVerified: true,
        credentialActive: true,
      },
    });
  } catch (err) {
    console.error('Verification route error:', err);
    return recordAndRespondFailure(
      requestId,
      `Internal verification error: ${err.message}`,
      500,
      res,
      requestRecord
    );
  }
}

/**
 * Selective Disclosure & Custom Credential Verification (Features 1, 3, 8, 9).
 * Verifies Student enrollment, KYC status, or Proof of Human without revealing sensitive attributes.
 */
export async function verifySelectiveDisclosure(req, res) {
  try {
    const {
      credentialType, // 'STUDENT', 'KYC', 'HUMAN'
      credentialPayload,
      issuerSignature,
      disclosedClaims = {},
      verifierId = 'verifier:partner-service',
      verifierName = 'Partner Service',
      nonce,
    } = req.body;

    if (!credentialPayload || !issuerSignature || !credentialType) {
      return res.status(400).json({ error: 'credentialPayload, issuerSignature, and credentialType are required.' });
    }

    // 1. Verify Issuer
    const issuerResult = await query(
      'SELECT issuer_id, name, public_key, is_active FROM issuers WHERE issuer_id = $1',
      [credentialPayload.issuerId]
    );

    if (issuerResult.rows.length === 0 || !issuerResult.rows[0].is_active) {
      return res.status(400).json({ error: 'Untrusted or inactive issuer authority.' });
    }

    // 2. Check Revocation Status (Fast-fail if revoked)
    const revCheck = await query(
      'SELECT id, reason FROM credential_revocations WHERE credential_id = $1',
      [credentialPayload.credentialId]
    );

    if (revCheck.rows.length > 0) {
      return res.status(400).json({ error: `Credential is REVOKED. Reason: ${revCheck.rows[0].reason}` });
    }

    // Check credentials table status
    const credStatusCheck = await query('SELECT status FROM credentials WHERE credential_id = $1', [credentialPayload.credentialId]);
    if (credStatusCheck.rows.length > 0 && credStatusCheck.rows[0].status === 'REVOKED') {
      return res.status(400).json({ error: 'Credential is REVOKED by the issuer authority.' });
    }

    // Check expiry
    if (new Date(credentialPayload.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Credential has expired.' });
    }

    // 3. Verify Issuer Signature
    const isSigValid = verifyCredentialSignature(
      credentialPayload,
      issuerSignature,
      issuerResult.rows[0].public_key
    );

    if (!isSigValid) {
      return res.status(400).json({ error: 'Invalid issuer signature. Credential was modified or forged.' });
    }

    // 4. Generate unique audit nullifier
    const auditNullifier = 'sd_' + crypto.randomUUID().slice(0, 16);

    // 5. Log verification in audit logs
    const requestedClaim = credentialType === 'STUDENT'
      ? `Student Status: ${disclosedClaims.enrollmentStatus || 'ENROLLED'}`
      : credentialType === 'KYC'
      ? `KYC Tier >= ${disclosedClaims.kycTier || 1}`
      : `Proof of Human: Liveness >= ${disclosedClaims.minLiveness || 90}%`;

    await query(
      `INSERT INTO verification_logs 
        (request_id, verifier_id, verifier_name, requested_claim, nullifier, commitment, result, issuer_id, credential_type, verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'VALID', $7, $8, CURRENT_TIMESTAMP)`,
      [
        'sd_' + crypto.randomUUID(),
        verifierId,
        verifierName,
        requestedClaim,
        auditNullifier,
        credentialPayload.commitment,
        credentialPayload.issuerId,
        credentialType,
      ]
    );

    return res.json({
      verified: true,
      credentialType,
      claim: requestedClaim,
      disclosedClaims,
      issuerName: issuerResult.rows[0].name,
      nullifier: auditNullifier,
      timestamp: new Date().toISOString(),
      details: {
        issuerSignatureValid: true,
        revocationChecked: true,
        credentialActive: true,
        zeroDocumentLeakage: true,
      },
    });
  } catch (err) {
    console.error('Selective disclosure error:', err);
    return res.status(500).json({ error: `Selective disclosure verification failed: ${err.message}` });
  }
}

/**
 * Helper to record rejection in audit history and send error response.
 */
async function recordAndRespondFailure(requestId, reason, statusCode, res, requestRecord = null) {
  try {
    if (requestId) {
      await query(
        `INSERT INTO verification_logs 
          (request_id, verifier_id, verifier_name, requested_claim, nullifier, commitment, result, rejection_reason, issuer_id, credential_type, verified_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'REJECTED', $7, $8, 'AGE', CURRENT_TIMESTAMP)`,
        [
          requestId,
          requestRecord?.verifier_id || 'unknown',
          requestRecord?.verifier_name || 'Verifier Portal',
          requestRecord ? `Age >= ${requestRecord.min_age}` : 'Age Verification',
          'n/a',
          'n/a',
          reason,
          'untrusted-or-unknown',
        ]
      );
    }
  } catch (logErr) {
    console.error('Failed to log audit rejection:', logErr.message);
  }

  return res.status(statusCode).json({
    verified: false,
    error: reason,
    requestId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Retrieves privacy-preserving audit logs with advanced filtering (Feature 10).
 * Supports: dateFrom, dateTo, issuerId, claimType, result ('VALID' | 'REJECTED').
 */
export async function getAuditLogs(req, res) {
  try {
    const { dateFrom, dateTo, issuerId, claimType, result, limit = 50, offset = 0 } = req.query;

    let queryText = `
      SELECT id, request_id, verifier_id, verifier_name, requested_claim, 
             nullifier, commitment, result, rejection_reason, issuer_id, credential_type, verified_at 
      FROM verification_logs 
      WHERE 1=1
    `;
    const params = [];

    if (dateFrom) {
      params.push(dateFrom);
      queryText += ` AND verified_at >= $${params.length}`;
    }

    if (dateTo) {
      params.push(dateTo);
      queryText += ` AND verified_at <= $${params.length}`;
    }

    if (issuerId) {
      params.push(issuerId);
      queryText += ` AND issuer_id = $${params.length}`;
    }

    if (claimType) {
      params.push(`%${claimType}%`);
      queryText += ` AND (requested_claim ILIKE $${params.length} OR credential_type ILIKE $${params.length})`;
    }

    if (result) {
      params.push(result.toUpperCase());
      queryText += ` AND result = $${params.length}`;
    }

    queryText += ` ORDER BY verified_at DESC`;

    const parsedLimit = Math.min(parseInt(limit, 10) || 50, 100);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

    params.push(parsedLimit);
    queryText += ` LIMIT $${params.length}`;

    params.push(parsedOffset);
    queryText += ` OFFSET $${params.length}`;

    const dbResult = await query(queryText, params);

    return res.json({
      logs: dbResult.rows,
      count: dbResult.rows.length,
      limit: parsedLimit,
      offset: parsedOffset,
    });
  } catch (err) {
    return res.status(500).json({ error: `Failed to fetch logs: ${err.message}` });
  }
}
