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
  registerUniversity,
  listColleges,
  getIssuerDashboard,
  rotateIssuerKey,
  issueStudentCredential,
  issueCredential,
  issueKycCredential,
} from '../backend/src/controllers/issuerController.js';
import {
  revokeCredential,
  getRevocationStatus,
  batchCheckStatus,
  listRevocations,
} from '../backend/src/controllers/revocationController.js';
import {
  verifySelectiveDisclosure,
  getAuditLogs,
} from '../backend/src/controllers/verifierController.js';
import {
  getBlockchainStatus,
  getAllOnchainIssuers,
} from '../backend/src/services/blockchainService.js';

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

async function runPhase3Tests() {
  console.log('\n================================================================');
  console.log('       ZK-TRUST PHASE 3: ADVANCED FEATURES TEST SUITE           ');
  console.log('       Student Verification, Multi-Issuer & Revocation Sync     ');
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
  // PART 1: ACCREDITED UNIVERSITY REGISTRATION & DIRECTORY
  // --------------------------------------------------------------------------
  console.log('\n--- Part 1: University Accreditation & Collegiate Directory ---');

  let berkeleyIssuerId = null;
  await test('Accredits and registers University of California, Berkeley as collegiate issuer', async () => {
    const { req, res } = mockReqRes({
      universityName: 'University of California Berkeley',
      officialDomain: 'berkeley.edu',
      country: 'US',
      contactEmail: 'registrar@berkeley.edu',
      accreditationBody: 'Western Association of Schools and Colleges (WASC)',
    });
    await registerUniversity(req, res);
    assert.strictEqual(res.getStatusCode(), 201);
    const data = res.getData();
    assert(data.university.issuerId.includes('berkeley'));
    assert(data.university.publicKey.includes('BEGIN PUBLIC KEY'));
    berkeleyIssuerId = data.university.issuerId;
  });

  await test('Colleges directory lists accredited universities with student metrics', async () => {
    const { req, res } = mockReqRes();
    await listColleges(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    const colleges = res.getData().colleges;
    assert(colleges.length >= 3);
    const berkeley = colleges.find((c) => c.issuer_id === berkeleyIssuerId);
    assert(berkeley, 'Berkeley must be listed in collegiate directory');
    assert.strictEqual(berkeley.official_domain, 'https://berkeley.edu');
  });

  // --------------------------------------------------------------------------
  // PART 2: UNAUTHORIZED ISSUER PROTECTION & ROLE BOUNDARIES
  // --------------------------------------------------------------------------
  console.log('\n--- Part 2: Unauthorized Issuer Protection ---');

  await test('Rejects issuance attempt by unregistered or untrusted issuer authority', async () => {
    const { req, res } = mockReqRes({
      fullName: 'Eve Hacker',
      age: 25,
      issuerId: 'did:zktrust:issuer:rogue-authority-666',
    });
    await issueCredential(req, res);
    assert.strictEqual(res.getStatusCode(), 403);
    assert(res.getData().error.includes('Unauthorized issuer'));
  });

  await test('Prevents non-university authority (Gov Authority) from issuing student credentials', async () => {
    const { req, res } = mockReqRes({
      studentId: 'STU-9999',
      fullName: 'Mallory Malicious',
      collegeName: 'MIT',
      graduationYear: 2027,
      issuerId: 'did:zktrust:issuer:gov-demo-1', // Gov authority cannot issue student IDs
    });
    await issueStudentCredential(req, res);
    assert.strictEqual(res.getStatusCode(), 400);
    assert(res.getData().error.includes('not accredited as a collegiate authority'));
  });

  // --------------------------------------------------------------------------
  // PART 3: STUDENT CREDENTIAL ISSUANCE & PRIVACY DISCLOSURE
  // --------------------------------------------------------------------------
  console.log('\n--- Part 3: Student Verification & Privacy Disclosure ---');

  let issuedStudent = null;
  await test('Berkeley Registrar issues tamper-proof student credential', async () => {
    const { req, res } = mockReqRes({
      studentId: 'UCB-EECS-2026-4401',
      fullName: 'Jordan Taylor',
      collegeName: 'University of California Berkeley',
      department: 'Electrical Engineering & Computer Sciences',
      course: 'B.S. in Computer Science',
      graduationYear: 2026,
      enrollmentStatus: 'ENROLLED',
      issuerId: berkeleyIssuerId,
    });
    await issueStudentCredential(req, res);
    assert.strictEqual(res.getStatusCode(), 201);
    issuedStudent = res.getData();
    assert.strictEqual(issuedStudent.credential.issuerId, berkeleyIssuerId);
    assert.strictEqual(issuedStudent.credential.graduationYear, 2026);
  });

  await test('Student selectively proves active enrollment for campus discount', async () => {
    const { req, res } = mockReqRes({
      credentialType: 'STUDENT',
      credentialPayload: {
        credentialId: issuedStudent.credential.credentialId,
        issuerId: issuedStudent.credential.issuerId,
        commitment: issuedStudent.credential.commitment,
        issuedAt: issuedStudent.credential.issuedAt,
        expiresAt: issuedStudent.credential.expiresAt,
      },
      issuerSignature: issuedStudent.credential.issuerSignature,
      disclosedClaims: {
        collegeName: 'University of California Berkeley',
        enrollmentStatus: 'ENROLLED',
        graduationYear: 2026,
      },
      verifierId: 'verifier:transit-perk',
      verifierName: 'Bay Area Rapid Transit',
    });
    await verifySelectiveDisclosure(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    assert.strictEqual(res.getData().verified, true);
    assert.strictEqual(res.getData().disclosedClaims.studentId, undefined); // No raw student ID leaked!
    assert.strictEqual(res.getData().disclosedClaims.fullName, undefined); // No name leaked!
  });

  // --------------------------------------------------------------------------
  // PART 4: ISSUER MANAGEMENT DASHBOARD & KEY ROTATION
  // --------------------------------------------------------------------------
  console.log('\n--- Part 4: Issuer Management Dashboard & Key Rotation ---');

  await test('Issuer dashboard returns telemetry, counts, and recent credentials', async () => {
    const { req, res } = mockReqRes({}, { issuerId: berkeleyIssuerId });
    await getIssuerDashboard(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    const data = res.getData();
    assert.strictEqual(data.issuer.issuer_id, berkeleyIssuerId);
    assert.strictEqual(Number(data.stats.total_issued), 1);
    assert.strictEqual(Number(data.stats.student_count), 1);
    assert.strictEqual(data.recentCredentials.length, 1);
  });

  let newBerkeleyPublicKey = null;
  await test('Berkeley rotates Ed25519 signing keypair with on-chain synchronization', async () => {
    const { req, res } = mockReqRes({ issuerId: berkeleyIssuerId });
    await rotateIssuerKey(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    const data = res.getData();
    assert(data.newPublicKey.includes('BEGIN PUBLIC KEY'));
    newBerkeleyPublicKey = data.newPublicKey;

    // Verify key was updated in database
    const dbCheck = await query('SELECT public_key FROM issuers WHERE issuer_id = $1', [berkeleyIssuerId]);
    assert.strictEqual(dbCheck.rows[0].public_key, newBerkeleyPublicKey);

    // Verify key was updated on-chain
    const onchainIssuers = await getAllOnchainIssuers();
    const onchainBerkeley = onchainIssuers.find((i) => i.issuerId === berkeleyIssuerId);
    assert(onchainBerkeley);
    assert.strictEqual(onchainBerkeley.publicKeyPem, newBerkeleyPublicKey);
  });

  await test('Subsequent credentials issued by Berkeley are signed with new rotated key', async () => {
    const { req, res } = mockReqRes({
      studentId: 'UCB-DATA-2027-1092',
      fullName: 'Samantha Reed',
      collegeName: 'University of California Berkeley',
      department: 'Data Science',
      course: 'B.A. in Data Science',
      graduationYear: 2027,
      enrollmentStatus: 'ENROLLED',
      issuerId: berkeleyIssuerId,
    });
    await issueStudentCredential(req, res);
    assert.strictEqual(res.getStatusCode(), 201);
    const newCred = res.getData().credential;

    // Verify signature with new rotated public key
    const sigValid = verifyCredentialSignature(
      {
        credentialId: newCred.credentialId,
        issuerId: newCred.issuerId,
        commitment: newCred.commitment,
        issuedAt: newCred.issuedAt,
        expiresAt: newCred.expiresAt,
      },
      newCred.issuerSignature,
      newBerkeleyPublicKey
    );
    assert.strictEqual(sigValid, true, 'Must verify against rotated public key');
  });

  // --------------------------------------------------------------------------
  // PART 5: CREDENTIAL REVOCATION & BATCH STATUS AUTO-SYNC
  // --------------------------------------------------------------------------
  console.log('\n--- Part 5: Credential Revocation & Batch Wallet Sync ---');

  // Issue 2 additional credentials
  const ageRes = mockReqRes({ fullName: 'Citizen One', age: 24, dateOfBirth: '2002-01-01' });
  await issueCredential(ageRes.req, ageRes.res);
  const credAge = ageRes.res.getData().credential;

  const kycRes = mockReqRes({ fullName: 'Citizen Two', kycTier: 2, jurisdiction: 'US' });
  await issueKycCredential(kycRes.req, kycRes.res);
  const credKyc = kycRes.res.getData().credential;

  await test('Accredited university revokes student credential with disciplinary reason', async () => {
    const { req, res } = mockReqRes({
      credentialId: issuedStudent.credential.credentialId,
      issuerId: berkeleyIssuerId,
      reason: 'Academic suspension: Student withdrew from semester',
    });
    await revokeCredential(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    assert.strictEqual(res.getData().message, 'Credential successfully revoked.');
  });

  await test('Batch revocation check accurately resolves statuses for wallet credentials', async () => {
    const { req, res } = mockReqRes({
      credentialIds: [
        issuedStudent.credential.credentialId,
        credAge.credentialId,
        credKyc.credentialId,
      ],
    });
    await batchCheckStatus(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    const statuses = res.getData().statuses;
    assert.strictEqual(statuses.length, 3);

    const studentStatus = statuses.find((s) => s.credentialId === issuedStudent.credential.credentialId);
    const ageStatus = statuses.find((s) => s.credentialId === credAge.credentialId);
    const kycStatus = statuses.find((s) => s.credentialId === credKyc.credentialId);

    assert.strictEqual(studentStatus.status, 'REVOKED');
    assert.strictEqual(studentStatus.isRevoked, true);
    assert(studentStatus.revocationDetails.reason.includes('withdrew from semester'));

    assert.strictEqual(ageStatus.status, 'ACTIVE');
    assert.strictEqual(ageStatus.isRevoked, false);

    assert.strictEqual(kycStatus.status, 'ACTIVE');
    assert.strictEqual(kycStatus.isRevoked, false);
  });

  await test('Verifier strictly rejects revoked student credential presentation', async () => {
    const { req, res } = mockReqRes({
      credentialType: 'STUDENT',
      credentialPayload: {
        credentialId: issuedStudent.credential.credentialId,
        issuerId: issuedStudent.credential.issuerId,
        commitment: issuedStudent.credential.commitment,
        issuedAt: issuedStudent.credential.issuedAt,
        expiresAt: issuedStudent.credential.expiresAt,
      },
      issuerSignature: issuedStudent.credential.issuerSignature,
      disclosedClaims: { enrollmentStatus: 'ENROLLED' },
    });
    await verifySelectiveDisclosure(req, res);
    assert.strictEqual(res.getStatusCode(), 400);
    assert(res.getData().error.includes('REVOKED'));
  });

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`PHASE 3 TEST SUMMARY: ${passed} of ${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase3Tests().catch((err) => {
  console.error('Phase 3 test execution error:', err);
  process.exit(1);
});
