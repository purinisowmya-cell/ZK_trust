import { generateEd25519KeyPair } from './cryptoService.js';
import { query } from '../db/index.js';
import { config } from '../config/index.js';

// Map of issuerId -> { privateKey, publicKey }
const issuerKeyPairs = new Map();

export const DEFAULT_ISSUERS = [
  {
    orgId: 'org:gov-id',
    orgName: 'National Digital Identity Authority',
    orgType: 'GOVERNMENT',
    contactEmail: 'admin@gov.id.example',
    website: 'https://identity.gov.example',
    issuerId: 'did:zktrust:issuer:gov-demo-1',
    name: 'Official Identity & Licensing Authority (Demo)',
    issuerType: 'GOVERNMENT',
    description: 'National government agency issuing official verified citizen identity credentials.',
    onchainAddress: '0x71C8360f3a46d142E94c5e3170e17B1E40786968',
  },
  {
    orgId: 'org:mit-edu',
    orgName: 'Massachusetts Institute of Technology',
    orgType: 'UNIVERSITY',
    contactEmail: 'registrar@mit.edu.example',
    website: 'https://mit.edu',
    issuerId: 'did:zktrust:issuer:mit-edu',
    name: 'MIT Academic Registrar & Student Authority',
    issuerType: 'UNIVERSITY',
    description: 'Accredited university issuing verified student enrollment and degree credentials.',
    onchainAddress: '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4',
  },
  {
    orgId: 'org:stanford-edu',
    orgName: 'Stanford University',
    orgType: 'UNIVERSITY',
    contactEmail: 'registrar@stanford.edu.example',
    website: 'https://stanford.edu',
    issuerId: 'did:zktrust:issuer:stanford-edu',
    name: 'Stanford University Registrar',
    issuerType: 'UNIVERSITY',
    description: 'Accredited collegiate institution issuing tamper-proof student credentials.',
    onchainAddress: '0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2',
  },
  {
    orgId: 'org:trust-kyc',
    orgName: 'TrustKYC Global Compliance Services',
    orgType: 'KYC_PROVIDER',
    contactEmail: 'compliance@trustkyc.example',
    website: 'https://trustkyc.example',
    issuerId: 'did:zktrust:issuer:trust-kyc',
    name: 'TrustKYC Enterprise Identity Issuer',
    issuerType: 'KYC_PROVIDER',
    description: 'AML/CFT compliant verification provider issuing zero-knowledge KYC attestations.',
    onchainAddress: '0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db',
  },
  {
    orgId: 'org:human-id',
    orgName: 'WorldHuman Biometric & Sybil Defense Labs',
    orgType: 'HUMAN_ATTESTER',
    contactEmail: 'labs@worldhuman.example',
    website: 'https://worldhuman.example',
    issuerId: 'did:zktrust:issuer:human-id',
    name: 'WorldHuman Attestation Protocol',
    issuerType: 'HUMAN_ATTESTER',
    description: 'Decentralized liveness and unique human attestation for Sybil resistance.',
    onchainAddress: '0x78731D3Ca6b7E34aC0F824c42a7cC18A495cabaB',
  },
];

/**
 * Initializes all default organizations and issuer keypairs.
 */
export async function initIssuerKeys() {
  console.log('--- Initializing Multi-Issuer Key Registry ---');

  for (const def of DEFAULT_ISSUERS) {
    let keyPair;
    // Check if government issuer has env keys configured
    if (def.issuerId === config.issuer.id && config.issuer.privateKeyPem && config.issuer.publicKeyPem) {
      keyPair = {
        privateKey: config.issuer.privateKeyPem,
        publicKey: config.issuer.publicKeyPem,
      };
    } else if (issuerKeyPairs.has(def.issuerId)) {
      keyPair = issuerKeyPairs.get(def.issuerId);
    } else {
      keyPair = generateEd25519KeyPair();
    }
    issuerKeyPairs.set(def.issuerId, keyPair);

    try {
      // 1. Upsert Organization
      const existingOrg = await query('SELECT org_id FROM organizations WHERE org_id = $1', [def.orgId]);
      if (existingOrg.rows.length === 0) {
        await query(
          `INSERT INTO organizations (org_id, name, org_type, contact_email, website, is_verified)
           VALUES ($1, $2, $3, $4, $5, true)`,
          [def.orgId, def.orgName, def.orgType, def.contactEmail, def.website]
        );
      }

      // 2. Upsert Issuer
      const existingIssuer = await query('SELECT issuer_id FROM issuers WHERE issuer_id = $1', [def.issuerId]);
      if (existingIssuer.rows.length === 0) {
        await query(
          `INSERT INTO issuers 
            (issuer_id, org_id, name, issuer_type, public_key, is_active, description, onchain_address)
           VALUES ($1, $2, $3, $4, $5, true, $6, $7)`,
          [def.issuerId, def.orgId, def.name, def.issuerType, keyPair.publicKey, def.description, def.onchainAddress]
        );
        console.log(`Registered issuer [${def.issuerType}]: ${def.name} (${def.issuerId})`);
      } else {
        await query(
          `UPDATE issuers 
           SET public_key = $1, name = $2, org_id = $3, issuer_type = $4, description = $5, onchain_address = $6
           WHERE issuer_id = $7`,
          [keyPair.publicKey, def.name, def.orgId, def.issuerType, def.description, def.onchainAddress, def.issuerId]
        );
      }
    } catch (err) {
      console.error(`Failed to register issuer ${def.issuerId} in DB:`, err.message);
    }
  }

  return issuerKeyPairs;
}

/**
 * Returns keypair for a specific issuer or the default demo issuer.
 */
export function getIssuerKeyPair(issuerId = null) {
  const targetId = issuerId || config.issuer.id;
  if (!issuerKeyPairs.has(targetId)) {
    throw new Error(`Issuer keys for '${targetId}' not found or not initialized.`);
  }
  return issuerKeyPairs.get(targetId);
}

/**
 * Returns public key for a specific issuer.
 */
export function getIssuerPublicKey(issuerId = null) {
  return getIssuerKeyPair(issuerId).publicKey;
}

/**
 * Dynamically registers a new custom issuer keypair at runtime.
 */
export function registerCustomIssuerKeys(issuerId, keyPair) {
  issuerKeyPairs.set(issuerId, keyPair);
}
