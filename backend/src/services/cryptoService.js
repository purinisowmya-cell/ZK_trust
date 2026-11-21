import crypto from 'crypto';
import { buildPoseidon } from 'circomlibjs';

let poseidonInstance = null;

/**
 * Initializes and caches the circomlibjs Poseidon instance.
 */
export async function getPoseidon() {
  if (!poseidonInstance) {
    poseidonInstance = await buildPoseidon();
  }
  return poseidonInstance;
}

/**
 * Computes Poseidon hash for an array of inputs (converted to BigInt).
 * Returns the hash as a decimal string in the BN254 / BabyJubjub scalar field.
 */
export async function poseidonHash(inputs) {
  const poseidon = await getPoseidon();
  const bigIntInputs = inputs.map(x => BigInt(x));
  const hashBytes = poseidon(bigIntInputs);
  const hashBigInt = poseidon.F.toObject(hashBytes);
  return hashBigInt.toString();
}

/**
 * Generates a cryptographically secure random secret as a BN254 field element string.
 */
export function generateRandomSecret() {
  // Generate 31 random bytes (248 bits) to guarantee it's strictly less than the BN254 scalar field prime
  const randomBytes = crypto.randomBytes(31);
  const secretBigInt = BigInt('0x' + randomBytes.toString('hex'));
  return secretBigInt.toString();
}

/**
 * Generates a cryptographically secure random verification nonce.
 */
export function generateVerificationNonce() {
  // 16 random bytes (128 bits) - fits safely in BN254 field
  const randomBytes = crypto.randomBytes(16);
  const nonceBigInt = BigInt('0x' + randomBytes.toString('hex'));
  return nonceBigInt.toString();
}

/**
 * Serializes a credential payload into its deterministic canonical string representation.
 */
export function serializeCanonicalPayload({ credentialId, issuerId, commitment, issuedAt, expiresAt }) {
  // ISO-8601 UTC timestamp normalization
  const issuedIso = new Date(issuedAt).toISOString();
  const expiresIso = new Date(expiresAt).toISOString();
  return `${credentialId}|${issuerId}|${commitment}|${issuedIso}|${expiresIso}`;
}

/**
 * Generates an Ed25519 keypair for identity issuance.
 */
export function generateEd25519KeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

/**
 * Converts any arbitrary string or value into a deterministic BN254 scalar field element.
 */
export function hashStringToField(str) {
  const hash = crypto.createHash('sha256').update(String(str)).digest();
  // Take 31 bytes to guarantee it fits safely in BN254 scalar field (< 2^253)
  return BigInt('0x' + hash.subarray(0, 31).toString('hex')).toString();
}

/**
 * Signs a canonical credential payload using the Issuer's Ed25519 private key.
 */
export function signCredentialPayload(payload, privateKeyPem) {
  const canonicalString = serializeCanonicalPayload(payload);
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const signatureBuffer = crypto.sign(null, Buffer.from(canonicalString, 'utf8'), privateKey);
  return signatureBuffer.toString('hex');
}

/**
 * Verifies an Issuer's Ed25519 digital signature over a canonical credential payload.
 */
export function verifyCredentialSignature(payload, signatureHex, publicKeyPem) {
  try {
    const canonicalString = serializeCanonicalPayload(payload);
    const publicKey = crypto.createPublicKey(publicKeyPem);
    const signatureBuffer = Buffer.from(signatureHex, 'hex');
    return crypto.verify(null, Buffer.from(canonicalString, 'utf8'), publicKey, signatureBuffer);
  } catch (err) {
    console.error('Signature verification error:', err.message);
    return false;
  }
}
