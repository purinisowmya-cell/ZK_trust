import { query } from '../db/index.js';
import { generateEd25519KeyPair } from '../services/cryptoService.js';
import { registerCustomIssuerKeys } from '../services/issuerKeyManager.js';

/**
 * Returns all registered organizations.
 */
export async function getOrganizations(req, res) {
  try {
    const result = await query(
      `SELECT org_id, name, org_type, contact_email, website, is_verified, created_at 
       FROM organizations 
       ORDER BY name ASC`
    );
    return res.json({ organizations: result.rows });
  } catch (err) {
    return res.status(500).json({ error: `Failed to fetch organizations: ${err.message}` });
  }
}

/**
 * Returns all registered issuers with organization details.
 */
export async function getIssuers(req, res) {
  try {
    const result = await query(
      `SELECT i.issuer_id, i.org_id, i.name, i.issuer_type, i.public_key, 
              i.is_active, i.description, i.onchain_address, i.created_at,
              o.name as org_name, o.website as org_website
       FROM issuers i
       LEFT JOIN organizations o ON i.org_id = o.org_id
       ORDER BY i.name ASC`
    );
    return res.json({ issuers: result.rows });
  } catch (err) {
    return res.status(500).json({ error: `Failed to fetch issuers: ${err.message}` });
  }
}

/**
 * Returns details for a single issuer.
 */
export async function getIssuerById(req, res) {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT i.issuer_id, i.org_id, i.name, i.issuer_type, i.public_key, 
              i.is_active, i.description, i.onchain_address, i.created_at,
              o.name as org_name, o.website as org_website
       FROM issuers i
       LEFT JOIN organizations o ON i.org_id = o.org_id
       WHERE i.issuer_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Issuer '${id}' not found.` });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: `Failed to fetch issuer: ${err.message}` });
  }
}

/**
 * Allows authorized registration of a new issuer (e.g. University, KYC provider).
 */
export async function registerIssuer(req, res) {
  try {
    const {
      name,
      orgId,
      orgName,
      orgType = 'UNIVERSITY',
      issuerType = 'UNIVERSITY',
      description,
      contactEmail,
      website,
      onchainAddress,
    } = req.body;

    if (!name || !orgName) {
      return res.status(400).json({ error: 'Issuer name and Organization name are required.' });
    }

    const effectiveOrgId = orgId || `org:${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const issuerId = `did:zktrust:issuer:${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    // Ensure Organization exists
    const orgCheck = await query('SELECT org_id FROM organizations WHERE org_id = $1', [effectiveOrgId]);
    if (orgCheck.rows.length === 0) {
      await query(
        `INSERT INTO organizations (org_id, name, org_type, contact_email, website, is_verified)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [effectiveOrgId, orgName, orgType, contactEmail || `${effectiveOrgId}@example.com`, website || 'https://example.com']
      );
    }

    // Generate new Ed25519 keypair for the newly registered issuer
    const keyPair = generateEd25519KeyPair();
    registerCustomIssuerKeys(issuerId, keyPair);

    const ethAddress = onchainAddress || '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    await query(
      `INSERT INTO issuers 
        (issuer_id, org_id, name, issuer_type, public_key, is_active, description, onchain_address)
       VALUES ($1, $2, $3, $4, $5, true, $6, $7)`,
      [issuerId, effectiveOrgId, name, issuerType, keyPair.publicKey, description || `${name} accredited credential authority`, ethAddress]
    );

    return res.status(201).json({
      message: 'Issuer successfully registered.',
      issuer: {
        issuerId,
        orgId: effectiveOrgId,
        name,
        issuerType,
        publicKey: keyPair.publicKey,
        isActive: true,
        onchainAddress: ethAddress,
      },
    });
  } catch (err) {
    console.error('Issuer registration error:', err);
    return res.status(500).json({ error: `Issuer registration failed: ${err.message}` });
  }
}
