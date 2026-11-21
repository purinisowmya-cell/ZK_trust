import { query } from '../db/index.js';

/**
 * Revokes an existing credential.
 */
export async function revokeCredential(req, res) {
  try {
    const { credentialId, issuerId, reason } = req.body;

    if (!credentialId || !reason) {
      return res.status(400).json({ error: 'credentialId and reason are required for revocation.' });
    }

    // Verify credential existence
    const credResult = await query(
      'SELECT credential_id, issuer_id, status FROM credentials WHERE credential_id = $1',
      [credentialId]
    );

    if (credResult.rows.length === 0) {
      return res.status(404).json({ error: `Credential '${credentialId}' not found.` });
    }

    const cred = credResult.rows[0];

    // Check authorization: if issuerId is supplied, it must match or issuer must be active
    const targetIssuerId = issuerId || cred.issuer_id;
    if (issuerId && cred.issuer_id !== issuerId) {
      return res.status(403).json({ error: 'Only the issuing authority can revoke this credential.' });
    }

    if (cred.status === 'REVOKED') {
      return res.status(400).json({ error: 'Credential has already been revoked previously.' });
    }

    // 1. Record in credential_revocations registry
    const revResult = await query(
      `INSERT INTO credential_revocations (credential_id, issuer_id, reason, revoked_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       RETURNING id, credential_id, issuer_id, reason, revoked_at`,
      [credentialId, targetIssuerId, reason]
    );

    // 2. Update status in credentials table
    await query(
      "UPDATE credentials SET status = 'REVOKED' WHERE credential_id = $1",
      [credentialId]
    );

    console.log(`[Revocation] Credential '${credentialId}' REVOKED by '${targetIssuerId}'. Reason: ${reason}`);

    return res.status(200).json({
      message: 'Credential successfully revoked.',
      revocation: revResult.rows[0],
    });
  } catch (err) {
    console.error('Revocation error:', err);
    return res.status(500).json({ error: `Failed to revoke credential: ${err.message}` });
  }
}

/**
 * Checks the real-time revocation status of any credential.
 */
export async function getRevocationStatus(req, res) {
  try {
    const { id } = req.params;

    const credResult = await query(
      'SELECT credential_id, issuer_id, status, expires_at FROM credentials WHERE credential_id = $1',
      [id]
    );

    if (credResult.rows.length === 0) {
      return res.status(404).json({ error: `Credential '${id}' not found in registry.` });
    }

    const cred = credResult.rows[0];
    const isExpired = new Date(cred.expires_at) < new Date();

    const revResult = await query(
      'SELECT id, issuer_id, reason, revoked_at FROM credential_revocations WHERE credential_id = $1 ORDER BY revoked_at DESC LIMIT 1',
      [id]
    );

    const isRevoked = cred.status === 'REVOKED' || revResult.rows.length > 0;

    return res.json({
      credentialId: cred.credential_id,
      issuerId: cred.issuer_id,
      isRevoked,
      isExpired,
      status: isRevoked ? 'REVOKED' : isExpired ? 'EXPIRED' : cred.status,
      revocationDetails: isRevoked && revResult.rows.length > 0 ? revResult.rows[0] : null,
    });
  } catch (err) {
    return res.status(500).json({ error: `Failed to check revocation status: ${err.message}` });
  }
}

/**
 * Lists all revoked credentials for public transparency and verification audit.
 */
export async function listRevocations(req, res) {
  try {
    const result = await query(
      `SELECT r.id, r.credential_id, r.issuer_id, r.reason, r.revoked_at,
              c.credential_type, i.name as issuer_name
       FROM credential_revocations r
       LEFT JOIN credentials c ON r.credential_id = c.credential_id
       LEFT JOIN issuers i ON r.issuer_id = i.issuer_id
       ORDER BY r.revoked_at DESC
       LIMIT 100`
    );
    return res.json({ revocations: result.rows });
  } catch (err) {
    return res.status(500).json({ error: `Failed to list revocations: ${err.message}` });
  }
}
