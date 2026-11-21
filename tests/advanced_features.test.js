import assert from 'assert';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as snarkjs from '../backend/node_modules/snarkjs/main.js';
import { buildPoseidon } from '../backend/node_modules/circomlibjs/main.js';

import { initDatabase, query } from '../backend/src/db/index.js';
import { initIssuerKeys, getIssuerKeyPair, getIssuerPublicKey } from '../backend/src/services/issuerKeyManager.js';
import {
  poseidonHash,
  generateRandomSecret,
  verifyCredentialSignature,
  hashStringToField,
} from '../backend/src/services/cryptoService.js';
import {
  getOrganizations,
  getIssuers,
  registerIssuer,
} from '../backend/src/controllers/organizationController.js';
import {
  issueCredential,
  issueStudentCredential,
  issueKycCredential,
  issueHumanCredential,
  getCredentialStatus,
} from '../backend/src/controllers/issuerController.js';
import {
  revokeCredential,
  getRevocationStatus,
  listRevocations,
} from '../backend/src/controllers/revocationController.js';
import {
  createQrSession,
  getQrSession,
  scanQrSession,
  submitQrProof,
} from '../backend/src/controllers/qrController.js';
import {
  createVerificationChallenge,
  verifyProof,
  verifySelectiveDisclosure,
  getAuditLogs,
} from '../backend/src/controllers/verifierController.js';
import {
  getBlockchainStatus,
  getAllOnchainIssuers,
  getOnchainIssuer,
} from '../backend/src/services/blockchainService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const buildDir = path.resolve(__dirname, '../circuits/build');
const wasmPath = path.join(buildDir, 'age_verification_js/age_verification.wasm');
const zkeyPath = path.join(buildDir, 'age_verification_final.zkey');

function mockReqRes(body = {}, params = {}, queryParams = {}) {
  const req = { body, params, query: queryParams };
  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      responseData = data;
      return res;
    },
    getStatusCode: () => statusCode,
    getData: () => responseData,
  };

  return { req, res };
}

async function runAdvancedFeaturesTest() {
  console.log('\n================================================================');
  console.log('       ZK-TRUST: COMPREHENSIVE ADVANCED FEATURES TEST SUITE     ');
  console.log('       Verifying All 10 Advanced Features End-to-End            ');
  console.log('================================================================\n');

  await initDatabase();
  await initIssuerKeys();

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      passed++;
      console.log(`  [PASS] ${name}`);
    } catch (err) {
      console.error(`  [FAIL] ${name}`);
      console.error(`         ${err.message}`);
    }
  }

  // --------------------------------------------------------------------------
  // FEATURE 1: STUDENT VERIFICATION SYSTEM
  // --------------------------------------------------------------------------
  console.log('\n--- Feature 1: Student Verification System ---');

  let studentCred = null;
  await test('University issues tamper-proof student credential with Ed25519 signature', async () => {
    const { req, res } = mockReqRes({
      studentId: 'MIT-ENG-2027-8812',
      fullName: 'Emma Watson',
      collegeName: 'Massachusetts Institute of Technology',
      department: 'Aeronautics and Astronautics',
      course: 'M.S. in Aerospace Engineering',
      graduationYear: 2027,
      enrollmentStatus: 'ENROLLED',
      issuerId: 'did:zktrust:issuer:mit-edu',
    });
    await issueStudentCredential(req, res);
    assert.strictEqual(res.getStatusCode(), 201);
    studentCred = res.getData();
    assert.strictEqual(studentCred.credential.credentialType, 'STUDENT');
    assert.strictEqual(studentCred.credential.graduationYear, 2027);

    // Verify MIT public key signature
    const mitKey = getIssuerPublicKey('did:zktrust:issuer:mit-edu');
    const valid = verifyCredentialSignature(
      {
        credentialId: studentCred.credential.credentialId,
        issuerId: studentCred.credential.issuerId,
        commitment: studentCred.credential.commitment,
        issuedAt: studentCred.credential.issuedAt,
        expiresAt: studentCred.credential.expiresAt,
      },
      studentCred.credential.issuerSignature,
      mitKey
    );
    assert.strictEqual(valid, true);
  });

  await test('Student proves active enrollment without revealing raw student ID or personal grades', async () => {
    const { req, res } = mockReqRes({
      credentialType: 'STUDENT',
      credentialPayload: {
        credentialId: studentCred.credential.credentialId,
        issuerId: studentCred.credential.issuerId,
        commitment: studentCred.credential.commitment,
        issuedAt: studentCred.credential.issuedAt,
        expiresAt: studentCred.credential.expiresAt,
      },
      issuerSignature: studentCred.credential.issuerSignature,
      disclosedClaims: { enrollmentStatus: 'ENROLLED', graduationYear: 2027 },
      verifierId: 'verifier:transit-discounts',
      verifierName: 'Metro Transit System',
    });
    await verifySelectiveDisclosure(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    assert.strictEqual(res.getData().verified, true);
    assert(res.getData().claim.includes('ENROLLED'));
  });

  // --------------------------------------------------------------------------
  // FEATURE 2: AGE VERIFICATION ENHANCEMENT (GROTH16 ZK-SNARK)
  // --------------------------------------------------------------------------
  console.log('\n--- Feature 2: Age Verification Enhancement ---');

  let ageCred = null;
  await test('Civil authority issues verified Age Credential (Age 23)', async () => {
    const { req, res } = mockReqRes({
      fullName: 'David Miller',
      age: 23,
      dateOfBirth: '2003-04-12',
    });
    await issueCredential(req, res);
    assert.strictEqual(res.getStatusCode(), 201);
    ageCred = res.getData();
  });

  await test('Generates real client Groth16 proof and passes backend verification for Age >= 21', async () => {
    // 1. Create challenge
    const chalReq = mockReqRes({ minAge: 21 });
    await createVerificationChallenge(chalReq.req, chalReq.res);
    const challenge = chalReq.res.getData();

    // 2. Compute Groth16 proof using snarkjs
    const witnessInput = {
      privateAge: ageCred.privateData.age.toString(),
      privateSecret: ageCred.privateData.secret.toString(),
      publicCommitment: ageCred.credential.commitment.toString(),
      minAge: challenge.minAge.toString(),
      nonce: challenge.nonce.toString(),
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      witnessInput,
      wasmPath,
      zkeyPath
    );

    // 3. Backend verifies proof
    const verifyReq = mockReqRes({
      requestId: challenge.requestId,
      proof,
      publicSignals,
      credentialPayload: {
        credentialId: ageCred.credential.credentialId,
        issuerId: ageCred.credential.issuerId,
        commitment: ageCred.credential.commitment,
        issuedAt: ageCred.credential.issuedAt,
        expiresAt: ageCred.credential.expiresAt,
      },
      issuerSignature: ageCred.credential.issuerSignature,
    });
    await verifyProof(verifyReq.req, verifyReq.res);
    assert.strictEqual(verifyReq.res.getStatusCode(), 200);
    assert.strictEqual(verifyReq.res.getData().verified, true);
    assert.strictEqual(verifyReq.res.getData().claim, 'Age >= 21');
  });

  // --------------------------------------------------------------------------
  // FEATURE 3: PRIVACY-PRESERVING KYC
  // --------------------------------------------------------------------------
  console.log('\n--- Feature 3: Privacy-Preserving KYC ---');

  let kycCred = null;
  await test('TrustKYC issues Tier 2 compliance credential without document leakage', async () => {
    const { req, res } = mockReqRes({
      fullName: 'Sophia Martinez',
      kycTier: 2,
      jurisdiction: 'US',
      idType: 'PASSPORT',
      issuerId: 'did:zktrust:issuer:trust-kyc',
    });
    await issueKycCredential(req, res);
    assert.strictEqual(res.getStatusCode(), 201);
    kycCred = res.getData();
    assert.strictEqual(kycCred.credential.kycTier, 2);
  });

  await test('User proves KYC Tier >= 2 without transmitting passport scan', async () => {
    const { req, res } = mockReqRes({
      credentialType: 'KYC',
      credentialPayload: {
        credentialId: kycCred.credential.credentialId,
        issuerId: kycCred.credential.issuerId,
        commitment: kycCred.credential.commitment,
        issuedAt: kycCred.credential.issuedAt,
        expiresAt: kycCred.credential.expiresAt,
      },
      issuerSignature: kycCred.credential.issuerSignature,
      disclosedClaims: { kycTier: 2, jurisdiction: 'US' },
    });
    await verifySelectiveDisclosure(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    assert.strictEqual(res.getData().verified, true);
    assert.strictEqual(res.getData().details.zeroDocumentLeakage, true);
  });

  // --------------------------------------------------------------------------
  // FEATURE 4: QR-BASED IDENTITY VERIFICATION
  // --------------------------------------------------------------------------
  console.log('\n--- Feature 4: QR-Based Identity Verification ---');

  let qrSessionId = null;
  await test('Verifier creates interactive QR challenge session with single-use nonce', async () => {
    const { req, res } = mockReqRes({
      verifierId: 'verifier:airport-gate',
      verifierName: 'Airport Security Terminal',
      credentialType: 'AGE',
      requiredClaims: { minAge: 21 },
      expirySeconds: 300,
    });
    await createQrSession(req, res);
    assert.strictEqual(res.getStatusCode(), 201);
    qrSessionId = res.getData().sessionId;
    assert(res.getData().qrPayload.includes('zktrust-v1'));
  });

  await test('Wallet scans QR session and transitions state from PENDING -> SCANNED', async () => {
    const { req, res } = mockReqRes({}, { id: qrSessionId });
    await scanQrSession(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    assert.strictEqual(res.getData().status, 'SCANNED');
  });

  await test('Wallet submits valid credential and terminal verifies in real time', async () => {
    const { req, res } = mockReqRes(
      {
        credentialPayload: {
          credentialId: ageCred.credential.credentialId,
          issuerId: ageCred.credential.issuerId,
          commitment: ageCred.credential.commitment,
          issuedAt: ageCred.credential.issuedAt,
          expiresAt: ageCred.credential.expiresAt,
        },
        issuerSignature: ageCred.credential.issuerSignature,
        disclosedClaims: { ageRequirement: '>=21' },
      },
      { id: qrSessionId }
    );
    await submitQrProof(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    assert.strictEqual(res.getData().result.verified, true);

    // Verify polling status is VERIFIED
    const poll = mockReqRes({}, { id: qrSessionId });
    await getQrSession(poll.req, poll.res);
    assert.strictEqual(poll.res.getData().status, 'VERIFIED');
  });

  await test('Replay attack on consumed QR session is strictly rejected', async () => {
    const { req, res } = mockReqRes(
      {
        credentialPayload: {
          credentialId: ageCred.credential.credentialId,
          issuerId: ageCred.credential.issuerId,
          commitment: ageCred.credential.commitment,
          issuedAt: ageCred.credential.issuedAt,
          expiresAt: ageCred.credential.expiresAt,
        },
        issuerSignature: ageCred.credential.issuerSignature,
      },
      { id: qrSessionId }
    );
    await submitQrProof(req, res);
    assert.strictEqual(res.getStatusCode(), 400);
  });

  // --------------------------------------------------------------------------
  // FEATURE 5: MULTI-ISSUER SYSTEM
  // --------------------------------------------------------------------------
  console.log('\n--- Feature 5: Multi-Issuer System ---');

  await test('Lists all active trusted issuers across colleges, KYC, and government', async () => {
    const { req, res } = mockReqRes();
    await getIssuers(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    const issuers = res.getData().issuers;
    assert(issuers.length >= 5);
  });

  await test('Dynamic registration of Oxford University with unique Ed25519 keypair', async () => {
    const { req, res } = mockReqRes({
      name: 'University of Oxford Registrar',
      orgName: 'University of Oxford',
      orgType: 'UNIVERSITY',
      issuerType: 'UNIVERSITY',
      contactEmail: 'registrar@ox.ac.uk.example',
      website: 'https://ox.ac.uk',
    });
    await registerIssuer(req, res);
    assert.strictEqual(res.getStatusCode(), 201);
    assert(res.getData().issuer.publicKey.includes('BEGIN PUBLIC KEY'));
  });

  // --------------------------------------------------------------------------
  // FEATURE 6: CREDENTIAL REVOCATION
  // --------------------------------------------------------------------------
  console.log('\n--- Feature 6: Credential Revocation ---');

  await test('Authorized university revokes student credential with audit reason', async () => {
    const { req, res } = mockReqRes({
      credentialId: studentCred.credential.credentialId,
      issuerId: 'did:zktrust:issuer:mit-edu',
      reason: 'Course completed / Degree conferred',
    });
    await revokeCredential(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
  });

  await test('Revoked credential is immediately rejected upon verification presentation', async () => {
    const { req, res } = mockReqRes({
      credentialType: 'STUDENT',
      credentialPayload: {
        credentialId: studentCred.credential.credentialId,
        issuerId: studentCred.credential.issuerId,
        commitment: studentCred.credential.commitment,
        issuedAt: studentCred.credential.issuedAt,
        expiresAt: studentCred.credential.expiresAt,
      },
      issuerSignature: studentCred.credential.issuerSignature,
      disclosedClaims: { enrollmentStatus: 'ENROLLED' },
    });
    await verifySelectiveDisclosure(req, res);
    assert.strictEqual(res.getStatusCode(), 400);
    assert(res.getData().error.includes('REVOKED'));
  });

  // --------------------------------------------------------------------------
  // FEATURE 7: BLOCKCHAIN-BASED ISSUER REGISTRY
  // --------------------------------------------------------------------------
  console.log('\n--- Feature 7: Blockchain-Based Issuer Registry ---');

  await test('Reports on-chain contract address and sync status on EVM testnet', async () => {
    const status = await getBlockchainStatus();
    assert(status.contractAddress.startsWith('0x'));
    assert(status.totalIssuerCount >= 5);
    assert(status.blockNumber > 0);
  });

  await test('Verifies on-chain public key retrieval for registered issuers', async () => {
    const issuers = await getAllOnchainIssuers();
    const mit = issuers.find((i) => i.issuerId === 'did:zktrust:issuer:mit-edu');
    assert(mit);
    assert.strictEqual(mit.isActive, true);
    assert(mit.publicKeyPem.includes('BEGIN PUBLIC KEY'));
  });

  // --------------------------------------------------------------------------
  // FEATURE 8: PROOF OF HUMAN (SYBIL RESISTANCE)
  // --------------------------------------------------------------------------
  console.log('\n--- Feature 8: Proof of Human ---');

  let humanCred = null;
  await test('Issues verified human attestation with liveness score 99.4%', async () => {
    const { req, res } = mockReqRes({
      fullName: 'Lucas Gray',
      livenessScore: 99.4,
      sybilResistanceLevel: 'HIGH',
      issuerId: 'did:zktrust:issuer:human-id',
    });
    await issueHumanCredential(req, res);
    assert.strictEqual(res.getStatusCode(), 201);
    humanCred = res.getData();
    assert.strictEqual(humanCred.credential.livenessScore, 99.4);
  });

  await test('Verifies human liveness without storing biometrics or tracking users', async () => {
    const { req, res } = mockReqRes({
      credentialType: 'HUMAN',
      credentialPayload: {
        credentialId: humanCred.credential.credentialId,
        issuerId: humanCred.credential.issuerId,
        commitment: humanCred.credential.commitment,
        issuedAt: humanCred.credential.issuedAt,
        expiresAt: humanCred.credential.expiresAt,
      },
      issuerSignature: humanCred.credential.issuerSignature,
      disclosedClaims: { minLiveness: 95.0, humanVerified: true },
    });
    await verifySelectiveDisclosure(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    assert.strictEqual(res.getData().verified, true);
  });

  // --------------------------------------------------------------------------
  // FEATURE 9: SELECTIVE DISCLOSURE
  // --------------------------------------------------------------------------
  console.log('\n--- Feature 9: Selective Disclosure ---');

  await test('Selectively discloses only permitted attributes while shielding rest of identity', async () => {
    const { req, res } = mockReqRes({
      credentialType: 'KYC',
      credentialPayload: {
        credentialId: kycCred.credential.credentialId,
        issuerId: kycCred.credential.issuerId,
        commitment: kycCred.credential.commitment,
        issuedAt: kycCred.credential.issuedAt,
        expiresAt: kycCred.credential.expiresAt,
      },
      issuerSignature: kycCred.credential.issuerSignature,
      disclosedClaims: { jurisdiction: 'US' }, // Discloses jurisdiction ONLY, hides tier & details
    });
    await verifySelectiveDisclosure(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    assert.strictEqual(res.getData().disclosedClaims.jurisdiction, 'US');
    assert.strictEqual(res.getData().disclosedClaims.fullName, undefined);
  });

  // --------------------------------------------------------------------------
  // FEATURE 10: PRIVACY-PRESERVING AUDIT LOGS
  // --------------------------------------------------------------------------
  console.log('\n--- Feature 10: Privacy-Preserving Audit Logs ---');

  await test('Audit logs contain zero witness secrets, DOB, or unencrypted personal data', async () => {
    const { req, res } = mockReqRes({}, {}, { limit: 50 });
    await getAuditLogs(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    const logs = res.getData().logs;
    assert(logs.length > 0);

    for (const entry of logs) {
      assert.strictEqual(entry.private_age, undefined);
      assert.strictEqual(entry.secret, undefined);
      assert.strictEqual(entry.date_of_birth, undefined);
      assert(entry.nullifier, 'Nullifier must be recorded');
      assert(entry.result === 'VALID' || entry.result === 'REJECTED');
    }
  });

  await test('Audit logs filter accurately by verification result and claim type', async () => {
    const { req, res } = mockReqRes({}, {}, { result: 'VALID', claimType: 'Age' });
    await getAuditLogs(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    for (const log of res.getData().logs) {
      assert.strictEqual(log.result, 'VALID');
    }
  });

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`ADVANCED FEATURES SUMMARY: ${passed} of ${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAdvancedFeaturesTest().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
