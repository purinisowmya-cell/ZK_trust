import { generateEd25519KeyPair } from './cryptoService.js';
import { query } from '../db/index.js';
import { config } from '../config/index.js';

let issuerKeyPair = null;

/**
 * Initializes the default demo issuer keypair and ensures it is registered in the database.
 */
export async function initIssuerKeys() {
  if (config.issuer.privateKeyPem && config.issuer.publicKeyPem) {
    issuerKeyPair = {
      privateKey: config.issuer.privateKeyPem,
      publicKey: config.issuer.publicKeyPem,
    };
  } else if (!issuerKeyPair) {
    console.log('Generating demo Ed25519 keypair for Issuer Authority...');
    issuerKeyPair = generateEd25519KeyPair();
  }

  // Ensure issuer is registered in the database
  try {
    const existing = await query('SELECT * FROM issuers WHERE issuer_id = $1', [config.issuer.id]);
    if (existing.rows.length === 0) {
      await query(
        'INSERT INTO issuers (issuer_id, name, public_key, is_active) VALUES ($1, $2, $3, $4)',
        [config.issuer.id, config.issuer.name, issuerKeyPair.publicKey, true]
      );
      console.log(`Demo Issuer registered: ${config.issuer.id}`);
    } else {
      // Update public key in DB to match current runtime key
      await query(
        'UPDATE issuers SET public_key = $1, name = $2 WHERE issuer_id = $3',
        [issuerKeyPair.publicKey, config.issuer.name, config.issuer.id]
      );
    }
  } catch (err) {
    console.error('Error registering demo issuer in DB:', err.message);
  }

  return issuerKeyPair;
}

export function getIssuerKeyPair() {
  if (!issuerKeyPair) {
    throw new Error('Issuer keys not initialized. Call initIssuerKeys() first.');
  }
  return issuerKeyPair;
}

export function getIssuerPublicKey() {
  return getIssuerKeyPair().publicKey;
}
