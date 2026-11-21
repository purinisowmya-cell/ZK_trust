import assert from 'assert';
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
  verifySelectiveDisclosure,
  getAuditLogs,
} from '../backend/src/controllers/verifierController.js';

// Helper to simulate express req/res
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

async function runPhase2Tests() {
  console.log('\n================================================================');
  console.log('       ZK-TRUST PHASE 2: DATABASE & BACKEND CORE TEST SUITE     ');
  console.log('================================================================\n');

  // 1. Initialize DB and Multi-Issuer Key Registry
  console.log('Step 1: Initializing embedded database and multi-issuer key registry...');
  await initDatabase();
  await initIssuerKeys();

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      passed++;
      console.log(`  [PASS] ${name}`);
    } catch (err) {
      console.error(`  [FAIL] ${name}`);
      console.error(`         ${err.message}`);
    }
  }

  async function asyncTest(name, fn) {
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
  // TEST GROUP 1: MULTI-ISSUER & ORGANIZATIONS
  // --------------------------------------------------------------------------
  console.log('\n--- Group 1: Multi-Issuer & Organization Management ---');

  await asyncTest('Default issuers and organizations are seeded in database', async () => {
    const { req, res } = mockReqRes();
    await getIssuers(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    const issuers = res.getData().issuers;
    assert(issuers.length >= 5, `Expected >= 5 issuers, got ${issuers.length}`);

    const issuerTypes = issuers.map((i) => i.issuer_type);
    assert(issuerTypes.includes('GOVERNMENT'), 'Missing GOVERNMENT issuer');
    assert(issuerTypes.includes('UNIVERSITY'), 'Missing UNIVERSITY issuer');
    assert(issuerTypes.includes('KYC_PROVIDER'), 'Missing KYC_PROVIDER issuer');
    assert(issuerTypes.includes('HUMAN_ATTESTER'), 'Missing HUMAN_ATTESTER issuer');
  });

  await asyncTest('Organizations endpoint returns registered institutions', async () => {
    const { req, res } = mockReqRes();
    await getOrganizations(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    const orgs = res.getData().organizations;
    assert(orgs.length >= 5, `Expected >= 5 organizations, got ${orgs.length}`);
    const names = orgs.map((o) => o.name);
    assert(names.some((n) => n.includes('Massachusetts Institute of Technology')));
  });

  await asyncTest('Dynamic registration of a new collegiate issuer (Harvard University)', async () => {
    const { req, res } = mockReqRes({
      name: 'Harvard University Registrar',
      orgName: 'Harvard University',
      orgType: 'UNIVERSITY',
      issuerType: 'UNIVERSITY',
      contactEmail: 'registrar@harvard.edu.example',
      website: 'https://harvard.edu',
    });
    await registerIssuer(req, res);
    assert.strictEqual(res.getStatusCode(), 201);
    const registered = res.getData().issuer;
    assert(registered.issuerId.includes('harvard'));
    assert(registered.publicKey.includes('BEGIN PUBLIC KEY'));
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 2: MULTI-CREDENTIAL ISSUANCE
  // --------------------------------------------------------------------------
  console.log('\n--- Group 2: Multi-Credential Issuance ---');

  let issuedAgeCred = null;
  let issuedStudentCred = null;
  let issuedKycCred = null;
  let issuedHumanCred = null;

  await asyncTest('Issue Age Credential with Poseidon commitment & Ed25519 signature', async () => {
    const { req, res } = mockReqRes({
      age: 22,
      fullName: 'Alice Smith',
      secret: '987654321987654321987654321',
    });
    await issueCredential(req, res);
    assert.strictEqual(res.getStatusCode(), 201);
    issuedAgeCred = res.getData();
    assert(issuedAgeCred.credential.credentialId.startsWith('cred_age_'));
    assert(issuedAgeCred.credential.commitment);
    assert(issuedAgeCred.credential.issuerSignature);

    // Verify Ed25519 signature
    const pubKey = getIssuerPublicKey(issuedAgeCred.credential.issuerId);
    const isValid = verifyCredentialSignature(
      {
        credentialId: issuedAgeCred.credential.credentialId,
        issuerId: issuedAgeCred.credential.issuerId,
        commitment: issuedAgeCred.credential.commitment,
        issuedAt: issuedAgeCred.credential.issuedAt,
        expiresAt: issuedAgeCred.credential.expiresAt,
      },
      issuedAgeCred.credential.issuerSignature,
      pubKey
    );
    assert.strictEqual(isValid, true, 'Issuer signature must be cryptographically valid');
  });

  await asyncTest('Issue Student Credential (Feature 1) by MIT with course and graduation year', async () => {
    const { req, res } = mockReqRes({
      studentId: 'MIT-CS-2027-0941',
      fullName: 'Bob Davis',
      collegeName: 'Massachusetts Institute of Technology',
      department: 'Electrical Engineering & Computer Science',
      course: 'M.Eng. in Artificial Intelligence',
      graduationYear: 2027,
      enrollmentStatus: 'ENROLLED',
      issuerId: 'did:zktrust:issuer:mit-edu',
    });
    await issueStudentCredential(req, res);
    assert.strictEqual(res.getStatusCode(), 201);
    issuedStudentCred = res.getData();
    assert(issuedStudentCred.credential.credentialId.startsWith('cred_stu_'));
    assert.strictEqual(issuedStudentCred.credential.issuerId, 'did:zktrust:issuer:mit-edu');
    assert.strictEqual(issuedStudentCred.credential.graduationYear, 2027);

    // Verify MIT signature
    const mitKey = getIssuerPublicKey('did:zktrust:issuer:mit-edu');
    const isMitSigOk = verifyCredentialSignature(
      {
        credentialId: issuedStudentCred.credential.credentialId,
        issuerId: issuedStudentCred.credential.issuerId,
        commitment: issuedStudentCred.credential.commitment,
        issuedAt: issuedStudentCred.credential.issuedAt,
        expiresAt: issuedStudentCred.credential.expiresAt,
      },
      issuedStudentCred.credential.issuerSignature,
      mitKey
    );
    assert.strictEqual(isMitSigOk, true, 'MIT digital signature must be valid');
  });

  await asyncTest('Issue Privacy-Preserving KYC Credential (Feature 3) with Tier 2 compliance', async () => {
    const { req, res } = mockReqRes({
      fullName: 'Charlie Kim',
      kycTier: 2,
      jurisdiction: 'EU',
      idType: 'PASSPORT',
      issuerId: 'did:zktrust:issuer:trust-kyc',
    });
    await issueKycCredential(req, res);
    assert.strictEqual(res.getStatusCode(), 201);
    issuedKycCred = res.getData();
    assert.strictEqual(issuedKycCred.credential.kycTier, 2);
    assert.strictEqual(issuedKycCred.credential.jurisdiction, 'EU');
  });

  await asyncTest('Issue Proof of Human Credential (Feature 8) with Liveness Score 99.2%', async () => {
    const { req, res } = mockReqRes({
      fullName: 'Dana Lee',
      livenessScore: 99.2,
      sybilResistanceLevel: 'HIGH',
      issuerId: 'did:zktrust:issuer:human-id',
    });
    await issueHumanCredential(req, res);
    assert.strictEqual(res.getStatusCode(), 201);
    issuedHumanCred = res.getData();
    assert.strictEqual(issuedHumanCred.credential.livenessScore, 99.2);
    assert.strictEqual(issuedHumanCred.credential.sybilResistanceLevel, 'HIGH');
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 3: CREDENTIAL REVOCATION (FEATURE 6)
  // --------------------------------------------------------------------------
  console.log('\n--- Group 3: Credential Revocation Workflow ---');

  await asyncTest('Check initial status of student credential (ACTIVE)', async () => {
    const { req, res } = mockReqRes({}, { id: issuedStudentCred.credential.credentialId });
    await getCredentialStatus(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    assert.strictEqual(res.getData().status, 'ACTIVE');
    assert.strictEqual(res.getData().isRevoked, false);
  });

  await asyncTest('Revoke student credential by issuing university with recorded reason', async () => {
    const { req, res } = mockReqRes({
      credentialId: issuedStudentCred.credential.credentialId,
      issuerId: 'did:zktrust:issuer:mit-edu',
      reason: 'Student graduated early; degree credentials superceded.',
    });
    await revokeCredential(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    assert.strictEqual(res.getData().message, 'Credential successfully revoked.');
  });

  await asyncTest('Revocation status endpoint confirms credential is REVOKED', async () => {
    const { req, res } = mockReqRes({}, { id: issuedStudentCred.credential.credentialId });
    await getRevocationStatus(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    assert.strictEqual(res.getData().status, 'REVOKED');
    assert.strictEqual(res.getData().isRevoked, true);
    assert(res.getData().revocationDetails.reason.includes('graduated early'));
  });

  await asyncTest('Public revocation registry includes the revoked credential', async () => {
    const { req, res } = mockReqRes();
    await listRevocations(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    const revs = res.getData().revocations;
    const found = revs.find((r) => r.credential_id === issuedStudentCred.credential.credentialId);
    assert(found, 'Revoked credential must appear in public revocation registry');
  });

  await asyncTest('Verifier rejects presentation of revoked credential', async () => {
    const { req, res } = mockReqRes({
      credentialType: 'STUDENT',
      credentialPayload: {
        credentialId: issuedStudentCred.credential.credentialId,
        issuerId: issuedStudentCred.credential.issuerId,
        commitment: issuedStudentCred.credential.commitment,
        issuedAt: issuedStudentCred.credential.issuedAt,
        expiresAt: issuedStudentCred.credential.expiresAt,
      },
      issuerSignature: issuedStudentCred.credential.issuerSignature,
      disclosedClaims: { enrollmentStatus: 'ENROLLED' },
    });
    await verifySelectiveDisclosure(req, res);
    assert.strictEqual(res.getStatusCode(), 400);
    assert(res.getData().error.includes('REVOKED'), 'Must fail with REVOKED error');
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 4: QR-BASED IDENTITY VERIFICATION (FEATURE 4)
  // --------------------------------------------------------------------------
  console.log('\n--- Group 4: QR Verification Session Lifecycle ---');

  let qrSessionId = null;
  let qrNonce = null;

  await asyncTest('Create dynamic QR verification session challenge', async () => {
    const { req, res } = mockReqRes({
      verifierId: 'verifier:campus-library',
      verifierName: 'Campus Library Entrance',
      credentialType: 'STUDENT',
      requiredClaims: { enrollmentStatus: 'ENROLLED' },
      expirySeconds: 300,
    });
    await createQrSession(req, res);
    assert.strictEqual(res.getStatusCode(), 201);
    const data = res.getData();
    assert(data.sessionId.startsWith('qr_sess_'));
    assert(data.qrPayload);
    assert(data.qrDeepLink);
    qrSessionId = data.sessionId;
    qrNonce = data.nonce;
  });

  await asyncTest('Poll QR session returns PENDING status', async () => {
    const { req, res } = mockReqRes({}, { id: qrSessionId });
    await getQrSession(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    assert.strictEqual(res.getData().status, 'PENDING');
  });

  await asyncTest('Wallet scans QR session -> status transitions to SCANNED', async () => {
    const { req, res } = mockReqRes({}, { id: qrSessionId });
    await scanQrSession(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    assert.strictEqual(res.getData().status, 'SCANNED');
  });

  await asyncTest('Wallet submits active Age Credential -> QR session marked VERIFIED', async () => {
    const { req, res } = mockReqRes(
      {
        credentialPayload: {
          credentialId: issuedAgeCred.credential.credentialId,
          issuerId: issuedAgeCred.credential.issuerId,
          commitment: issuedAgeCred.credential.commitment,
          issuedAt: issuedAgeCred.credential.issuedAt,
          expiresAt: issuedAgeCred.credential.expiresAt,
        },
        issuerSignature: issuedAgeCred.credential.issuerSignature,
        disclosedClaims: { ageEligibility: '>=18' },
      },
      { id: qrSessionId }
    );
    await submitQrProof(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    assert.strictEqual(res.getData().result.verified, true);

    // Verify polling now reports VERIFIED
    const pollCheck = mockReqRes({}, { id: qrSessionId });
    await getQrSession(pollCheck.req, pollCheck.res);
    assert.strictEqual(pollCheck.res.getData().status, 'VERIFIED');
  });

  await asyncTest('Submitting proof to already fulfilled QR session is rejected (anti-replay)', async () => {
    const { req, res } = mockReqRes(
      {
        credentialPayload: {
          credentialId: issuedAgeCred.credential.credentialId,
          issuerId: issuedAgeCred.credential.issuerId,
          commitment: issuedAgeCred.credential.commitment,
          issuedAt: issuedAgeCred.credential.issuedAt,
          expiresAt: issuedAgeCred.credential.expiresAt,
        },
        issuerSignature: issuedAgeCred.credential.issuerSignature,
      },
      { id: qrSessionId }
    );
    await submitQrProof(req, res);
    assert.strictEqual(res.getStatusCode(), 400);
    assert(res.getData().error.includes('Anti-replay') || res.getData().error.includes('not active'));
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 5: SELECTIVE DISCLOSURE & FILTERED AUDIT LOGS (FEATURES 9, 10)
  // --------------------------------------------------------------------------
  console.log('\n--- Group 5: Selective Disclosure & Audit Logs ---');

  await asyncTest('Selective disclosure verification for active KYC credential', async () => {
    const { req, res } = mockReqRes({
      credentialType: 'KYC',
      credentialPayload: {
        credentialId: issuedKycCred.credential.credentialId,
        issuerId: issuedKycCred.credential.issuerId,
        commitment: issuedKycCred.credential.commitment,
        issuedAt: issuedKycCred.credential.issuedAt,
        expiresAt: issuedKycCred.credential.expiresAt,
      },
      issuerSignature: issuedKycCred.credential.issuerSignature,
      disclosedClaims: { kycTier: 2, jurisdiction: 'EU' },
    });
    await verifySelectiveDisclosure(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    assert.strictEqual(res.getData().verified, true);
    assert.strictEqual(res.getData().details.zeroDocumentLeakage, true);
  });

  await asyncTest('Audit logs endpoint returns filtered logs without sensitive witness data', async () => {
    const { req, res } = mockReqRes({}, {}, { result: 'VALID', limit: 10 });
    await getAuditLogs(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    const logs = res.getData().logs;
    assert(logs.length > 0, 'Audit logs should contain verification entries');

    for (const log of logs) {
      assert.strictEqual(log.result, 'VALID');
      // Ensure NO sensitive private data exists in logs
      assert.strictEqual(log.private_age, undefined);
      assert.strictEqual(log.secret, undefined);
      assert.strictEqual(log.date_of_birth, undefined);
    }
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 6: BLOCKCHAIN-BASED ISSUER REGISTRY (FEATURE 7)
  // --------------------------------------------------------------------------
  console.log('\n--- Group 6: Blockchain-Based Issuer Registry ---');

  const { getBlockchainStatus, getAllOnchainIssuers, getOnchainIssuer } = await import(
    '../backend/src/services/blockchainService.js'
  );

  await asyncTest('Blockchain status returns contract address and network metadata', async () => {
    const status = await getBlockchainStatus();
    assert(status.contractAddress.startsWith('0x'));
    assert(status.network);
    assert(status.totalIssuerCount >= 5);
  });

  await asyncTest('All on-chain issuers are registered with verifiable public keys', async () => {
    const issuers = await getAllOnchainIssuers();
    assert(issuers.length >= 5);
    const mit = issuers.find((i) => i.issuerId.includes('mit-edu'));
    assert(mit, 'MIT on-chain issuer record must exist');
    assert(mit.publicKeyPem.includes('BEGIN PUBLIC KEY'));
    assert(mit.txHash.startsWith('0x'));
  });

  await asyncTest('Fetch single on-chain issuer by ID', async () => {
    const kyc = await getOnchainIssuer('did:zktrust:issuer:trust-kyc');
    assert(kyc);
    assert.strictEqual(kyc.issuerType, 'KYC_PROVIDER');
    assert.strictEqual(kyc.isActive, true);
  });

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} of ${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runPhase2Tests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
