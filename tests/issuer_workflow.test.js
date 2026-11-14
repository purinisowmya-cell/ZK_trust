import path from 'path';
import { fileURLToPath } from 'url';
import {
  generateRandomSecret,
  poseidonHash,
  generateEd25519KeyPair,
  serializeCanonicalPayload,
  signCredentialPayload,
  verifyCredentialSignature,
} from '../backend/src/services/cryptoService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runIssuerWorkflowTests() {
  console.log('\n================================================================');
  console.log('       MODULE 2 TEST: ISSUER-AUTHENTICATED CREDENTIAL WORKFLOW   ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(testName, condition, detail = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      if (detail) console.log(`       Detail: ${detail}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      if (detail) console.error(`       Detail: ${detail}`);
      failed++;
    }
  }

  // 1. Ed25519 Issuer Keypair Generation
  console.log('1. Testing Ed25519 Keypair Generation...');
  const keyPair = generateEd25519KeyPair();
  assert('Ed25519 private key generated in PKCS#8 format', keyPair.privateKey.includes('BEGIN PRIVATE KEY'));
  assert('Ed25519 public key generated in SPKI format', keyPair.publicKey.includes('BEGIN PUBLIC KEY'));
  assert('Private key is distinct from public key', keyPair.privateKey !== keyPair.publicKey);

  // 2. Secure Random Credential Secret
  console.log('\n2. Testing Secure Random Credential Secret Generation...');
  const secret1 = generateRandomSecret();
  const secret2 = generateRandomSecret();
  assert('Secret is non-empty string', typeof secret1 === 'string' && secret1.length > 20);
  assert('Secrets are cryptographically distinct (entropy check)', secret1 !== secret2);
  const secretBigInt = BigInt(secret1);
  const bn254Prime = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
  assert('Secret is strictly within BN254 scalar field order', secretBigInt > 0n && secretBigInt < bn254Prime, `Secret: ${secret1.slice(0, 16)}...`);

  // 3. Poseidon Commitment Calculation
  console.log('\n3. Testing Poseidon Commitment Calculation...');
  const syntheticAge = 21;
  const commitment1 = await poseidonHash([syntheticAge, secret1]);
  const commitment1Repeat = await poseidonHash([syntheticAge, secret1]);
  assert('Poseidon commitment is deterministic for same inputs', commitment1 === commitment1Repeat, `Commitment: ${commitment1}`);
  const differentAgeCommitment = await poseidonHash([syntheticAge + 1, secret1]);
  assert('Commitment changes when age changes', commitment1 !== differentAgeCommitment);
  const differentSecretCommitment = await poseidonHash([syntheticAge, secret2]);
  assert('Commitment changes when secret changes', commitment1 !== differentSecretCommitment);

  // 4. Canonical Credential Payload Construction
  console.log('\n4. Testing Canonical Credential Payload Construction...');
  const credentialPayload = {
    credentialId: 'cred_demo_12345',
    issuerId: 'did:zktrust:issuer:gov-demo-1',
    commitment: commitment1,
    issuedAt: '2026-11-14T08:00:00.000Z',
    expiresAt: '2027-11-14T08:00:00.000Z',
  };

  const canonicalString = serializeCanonicalPayload(credentialPayload);
  const expectedString = 'cred_demo_12345|did:zktrust:issuer:gov-demo-1|' + commitment1 + '|2026-11-14T08:00:00.000Z|2027-11-14T08:00:00.000Z';
  assert('Canonical serialization is deterministic pipe-delimited format', canonicalString === expectedString, canonicalString);

  // 5. Ed25519 Digital Signing
  console.log('\n5. Testing Digital Signing with Issuer Private Key...');
  const signatureHex = signCredentialPayload(credentialPayload, keyPair.privateKey);
  assert('Signature produced as hex string', typeof signatureHex === 'string' && signatureHex.length === 128, `Length: ${signatureHex.length} hex chars (64 bytes)`);

  // 6. Public Key Signature Verification
  console.log('\n6. Testing Verification with Issuer Public Key...');
  const isValid = verifyCredentialSignature(credentialPayload, signatureHex, keyPair.publicKey);
  assert('Valid canonical payload + signature verifies successfully', isValid === true);

  // 7. Security Test: Reject Modified Commitment
  console.log('\n7. Testing Security: Mismatched / Modified Commitment...');
  const tamperedCommitmentPayload = {
    ...credentialPayload,
    commitment: '9999999999999999999999999999999999999',
  };
  const isTamperedCommitmentValid = verifyCredentialSignature(
    tamperedCommitmentPayload,
    signatureHex,
    keyPair.publicKey
  );
  assert('Modified commitment is REJECTED by signature verification', isTamperedCommitmentValid === false);

  // 8. Security Test: Reject Corrupted Signature
  console.log('\n8. Testing Security: Corrupted Signature Bytes...');
  // Flip the first two hex characters
  const corruptedSignatureHex = (signatureHex[0] === 'a' ? 'b' : 'a') + signatureHex.slice(1);
  const isCorruptedSigValid = verifyCredentialSignature(
    credentialPayload,
    corruptedSignatureHex,
    keyPair.publicKey
  );
  assert('Corrupted signature bytes are REJECTED', isCorruptedSigValid === false);

  // 9. Security Test: Reject Rogue / Untrusted Issuer Key
  console.log('\n9. Testing Security: Untrusted Issuer Public Key...');
  const rogueKeyPair = generateEd25519KeyPair();
  const isRogueKeyValid = verifyCredentialSignature(
    credentialPayload,
    signatureHex,
    rogueKeyPair.publicKey
  );
  assert('Signature verified against wrong / rogue public key is REJECTED', isRogueKeyValid === false);

  // 10. Security Test: Reject Modified Expiration Date
  console.log('\n10. Testing Security: Tampered Expiration Date...');
  const tamperedExpiryPayload = {
    ...credentialPayload,
    expiresAt: '2030-01-01T00:00:00.000Z',
  };
  const isTamperedExpiryValid = verifyCredentialSignature(
    tamperedExpiryPayload,
    signatureHex,
    keyPair.publicKey
  );
  assert('Modified expiration date is REJECTED', isTamperedExpiryValid === false);

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED out of ${passed + failed} CHECKS.`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runIssuerWorkflowTests().catch((err) => {
  console.error('Fatal error during test:', err);
  process.exit(1);
});
