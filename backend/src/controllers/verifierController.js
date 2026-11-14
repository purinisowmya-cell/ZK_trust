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
    const { verifierId, verifierName, purpose, minAge = 18 } = req.body;

    const validatedMinAge = parseInt(minAge, 10);
    if (isNaN(validatedMinAge) || validatedMinAge < 0 || validatedMinAge > 150) {
      return res.status(400).json({ error: 'Valid minimum age between 0 and 150 is required.' });
    }

    const requestId = 'req_' + crypto.randomUUID();
    const nonce = generateVerificationNonce();
    const expiresAt = new Date(
      Date.now() + config.verification.challengeExpirySeconds * 1000
    ).toISOString();

    await query(
      `INSERT INTO verification_requests 
        (request_id, verifier_id, verifier_name, purpose, min_age, nonce, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7)`,
      [
        requestId,
        verifierId || 'verifier:demo-relying-party',
        verifierName || 'Age-Restricted Service (Demo)',
        purpose || 'Compliance age requirement check',
        validatedMinAge,
        nonce,
        expiresAt,
      ]
    );

    return res.status(201).json({
      requestId,
      nonce,
      minAge: validatedMinAge,
      verifierId: verifierId || 'verifier:demo-relying-party',
      verifierName: verifierName || 'Age-Restricted Service (Demo)',
      purpose: purpose || 'Compliance age requirement check',
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
      'SELECT request_id, verifier_id, verifier_name, purpose, min_age, nonce, status, expires_at FROM verification_requests WHERE request_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Verification request not found.' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: `Failed to fetch request: ${err.message}` });
  }
}

/**
 * Verifies a Zero-Knowledge Age Proof with complete end-to-end security checks.
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
    // Check 5: Credential Expiration & Revocation Status
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
        (request_id, verifier_id, verifier_name, requested_claim, nullifier, commitment, result, verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'VALID', CURRENT_TIMESTAMP)`,
      [
        requestId,
        requestRecord.verifier_id,
        requestRecord.verifier_name,
        `Age >= ${requestRecord.min_age}`,
        zkNullifier,
        zkCommitment,
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
 * Helper to record rejection in audit history and send error response.
 */
async function recordAndRespondFailure(requestId, reason, statusCode, res, requestRecord = null) {
  try {
    if (requestId) {
      await query(
        `INSERT INTO verification_logs 
          (request_id, verifier_id, verifier_name, requested_claim, nullifier, commitment, result, rejection_reason, verified_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'REJECTED', $7, CURRENT_TIMESTAMP)`,
        [
          requestId,
          requestRecord?.verifier_id || 'unknown',
          requestRecord?.verifier_name || 'Verifier Portal',
          requestRecord ? `Age >= ${requestRecord.min_age}` : 'Age Verification',
          'n/a',
          'n/a',
          reason,
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
 * Retrieves the privacy-preserving audit logs (No sensitive witness values).
 */
export async function getAuditLogs(req, res) {
  try {
    const result = await query(
      `SELECT id, request_id, verifier_name, requested_claim, nullifier, result, rejection_reason, verified_at 
       FROM verification_logs 
       ORDER BY verified_at DESC 
       LIMIT 50`
    );

    return res.json({ logs: result.rows });
  } catch (err) {
    return res.status(500).json({ error: `Failed to fetch logs: ${err.message}` });
  }
}
