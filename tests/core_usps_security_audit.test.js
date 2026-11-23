import assert from 'assert';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import * as snarkjs from '../backend/node_modules/snarkjs/main.js';

import { initDatabase, query } from '../backend/src/db/index.js';
import { initIssuerKeys, getIssuerKeyPair } from '../backend/src/services/issuerKeyManager.js';
import {
  poseidonHash,
  generateRandomSecret,
  verifyCredentialSignature,
  signCredentialPayload,
} from '../backend/src/services/cryptoService.js';
import { issueCredential } from '../backend/src/controllers/issuerController.js';
import {
  createVerificationChallenge,
  verifyProof,
  getAuditLogs,
} from '../backend/src/controllers/verifierController.js';
import {
  createQrSession,
  submitQrProof,
  rejectQrSession,
  getConsentRecords,
} from '../backend/src/controllers/qrController.js';

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

let testCount = 0;
let passedCount = 0;

async function test(name, fn) {
  testCount++;
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

async function runCoreUspsAudit() {
  console.log('\n================================================================');
  console.log('       ZK-TRUST: RIGOROUS 5 CORE USPs SECURITY AUDIT            ');
  console.log('================================================================\n');

  await initDatabase();
  await initIssuerKeys();

  const userAge = 22;
  const userSecret = generateRandomSecret();
  const issuerId = 'did:zktrust:issuer:gov-demo-1';

  // 1. Issue authentic credential
  const { req: issueReq, res: issueRes } = mockReqRes({
    age: userAge,
    secret: userSecret,
    issuerId,
    fullName: 'Audit Subject Alice',
  });
  await issueCredential(issueReq, issueRes);
  const issuedCred = issueRes.getData().credential;

  // --- USP 1: ISSUER-AUTHENTICATED ZERO-KNOWLEDGE PROOF ---
  console.log('--- USP 1: Issuer-Authenticated Zero-Knowledge Proof ---');
  
  await test('Verifies authentic Ed25519 signature on canonical credential payload', async () => {
    const keys = getIssuerKeyPair(issuerId);
    const validSig = verifyCredentialSignature(
      {
        credentialId: issuedCred.credentialId,
        issuerId: issuedCred.issuerId,
        commitment: issuedCred.commitment,
        issuedAt: issuedCred.issuedAt,
        expiresAt: issuedCred.expiresAt,
      },
      issuedCred.issuerSignature,
      keys.publicKey
    );
    assert.strictEqual(validSig, true);
  });

  await test('Rejects verification when issuer signature is corrupted or forged', async () => {
    const { req: chalReq, res: chalRes } = mockReqRes({ minAge: 18 });
    await createVerificationChallenge(chalReq, chalRes);
    const challenge = chalRes.getData();

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      {
        privateAge: userAge.toString(),
        privateSecret: userSecret.toString(),
        publicCommitment: issuedCred.commitment.toString(),
        minAge: '18',
        nonce: challenge.nonce.toString(),
      },
      wasmPath,
      zkeyPath
    );

    // Corrupt signature
    const corruptedSig = '00'.repeat(64);
    const { req: vReq, res: vRes } = mockReqRes({
      requestId: challenge.requestId,
      proof,
      publicSignals,
      credentialPayload: issuedCred,
      issuerSignature: corruptedSig,
    });
    await verifyProof(vReq, vRes);
    assert.strictEqual(vRes.getStatusCode(), 400);
    assert(vRes.getData().error.includes('Invalid Issuer digital signature'));
  });

  await test('Rejects verification when credential commitment does not match ZK proof commitment', async () => {
    const { req: chalReq, res: chalRes } = mockReqRes({ minAge: 18 });
    await createVerificationChallenge(chalReq, chalRes);
    const challenge = chalRes.getData();

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      {
        privateAge: userAge.toString(),
        privateSecret: userSecret.toString(),
        publicCommitment: issuedCred.commitment.toString(),
        minAge: '18',
        nonce: challenge.nonce.toString(),
      },
      wasmPath,
      zkeyPath
    );

    // Tamper with credential commitment
    const tamperedPayload = { ...issuedCred, commitment: '12345678901234567890' };
    const keys = getIssuerKeyPair(issuerId);
    const tamperedSig = signCredentialPayload(tamperedPayload, keys.privateKey);

    const { req: vReq, res: vRes } = mockReqRes({
      requestId: challenge.requestId,
      proof,
      publicSignals,
      credentialPayload: tamperedPayload,
      issuerSignature: tamperedSig,
    });
    await verifyProof(vReq, vRes);
    assert.strictEqual(vRes.getStatusCode(), 400);
    assert(vRes.getData().error.includes('Signed credential commitment does not match ZK proof commitment'));
  });

  // --- USP 2: USER-CONTROLLED CONSENT ---
  console.log('\n--- USP 2: User-Controlled Consent ---');

  await test('Explicit user consent generates proof locally without leaking witness to network', async () => {
    const { req: chalReq, res: chalRes } = mockReqRes({ minAge: 18, purpose: 'Nightclub Access Check' });
    await createVerificationChallenge(chalReq, chalRes);
    const challenge = chalRes.getData();

    assert.strictEqual(challenge.status, 'PENDING');
    assert.strictEqual(challenge.minAge, 18);

    // Proof computed locally in client context
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      {
        privateAge: userAge.toString(),
        privateSecret: userSecret.toString(),
        publicCommitment: issuedCred.commitment.toString(),
        minAge: '18',
        nonce: challenge.nonce.toString(),
      },
      wasmPath,
      zkeyPath
    );

    // Submit approved proof
    const { req: vReq, res: vRes } = mockReqRes({
      requestId: challenge.requestId,
      proof,
      publicSignals,
      credentialPayload: issuedCred,
      issuerSignature: issuedCred.issuerSignature,
    });
    await verifyProof(vReq, vRes);
    assert.strictEqual(vRes.getStatusCode(), 200);
    assert.strictEqual(vRes.getData().verified, true);
  });

  await test('User can reject/decline verification challenge; rejection is audited without leaking data', async () => {
    const { req: qrReq, res: qrRes } = mockReqRes({
      verifierId: 'verifier:alcohol-retailer',
      verifierName: 'City Liquor Store',
      credentialType: 'AGE',
      requiredClaims: { minAge: 21 },
    });
    await createQrSession(qrReq, qrRes);
    const session = qrRes.getData();

    // User rejects the session in consent modal
    const { req: rejReq, res: rejRes } = mockReqRes({
      reason: 'User declined to disclose age threshold for store discount',
      credentialId: issuedCred.credentialId,
    }, { id: session.sessionId });

    await rejectQrSession(rejReq, rejRes);
    assert.strictEqual(rejRes.getStatusCode(), 200);
    assert.strictEqual(rejRes.getData().status, 'REJECTED');

    // Verify consent record logged
    const { req: recReq, res: recRes } = mockReqRes();
    await getConsentRecords(recReq, recRes);
    const records = recRes.getData().consentRecords;
    const matched = records.find(r => r.session_or_request_id === session.sessionId);
    assert(matched, 'Consent rejection record should exist');
    assert.strictEqual(matched.consent_action, 'REJECTED');
  });

  // --- USP 3: REPLAY-RESISTANT VERIFICATION ---
  console.log('\n--- USP 3: Replay-Resistant Verification ---');

  await test('Enforces verification challenge expiration timeout', async () => {
    const { req: chalReq, res: chalRes } = mockReqRes({ minAge: 18 });
    await createVerificationChallenge(chalReq, chalRes);
    const challenge = chalRes.getData();

    // Manually expire challenge in database
    await query("UPDATE verification_requests SET expires_at = NOW() - INTERVAL '10 seconds' WHERE request_id = $1", [
      challenge.requestId,
    ]);

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      {
        privateAge: userAge.toString(),
        privateSecret: userSecret.toString(),
        publicCommitment: issuedCred.commitment.toString(),
        minAge: '18',
        nonce: challenge.nonce.toString(),
      },
      wasmPath,
      zkeyPath
    );

    const { req: vReq, res: vRes } = mockReqRes({
      requestId: challenge.requestId,
      proof,
      publicSignals,
      credentialPayload: issuedCred,
      issuerSignature: issuedCred.issuerSignature,
    });
    await verifyProof(vReq, vRes);
    assert.strictEqual(vRes.getStatusCode(), 400);
    assert(vRes.getData().error.includes('expired'));
  });

  await test('Strictly prevents replay attacks using identical request ID', async () => {
    const { req: chalReq, res: chalRes } = mockReqRes({ minAge: 18 });
    await createVerificationChallenge(chalReq, chalRes);
    const challenge = chalRes.getData();

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      {
        privateAge: userAge.toString(),
        privateSecret: userSecret.toString(),
        publicCommitment: issuedCred.commitment.toString(),
        minAge: '18',
        nonce: challenge.nonce.toString(),
      },
      wasmPath,
      zkeyPath
    );

    // First presentation -> 200 OK
    const { req: vReq1, res: vRes1 } = mockReqRes({
      requestId: challenge.requestId,
      proof,
      publicSignals,
      credentialPayload: issuedCred,
      issuerSignature: issuedCred.issuerSignature,
    });
    await verifyProof(vReq1, vRes1);
    assert.strictEqual(vRes1.getStatusCode(), 200);

    // Second presentation (Replay attempt) -> 400 REJECTED
    const { req: vReq2, res: vRes2 } = mockReqRes({
      requestId: challenge.requestId,
      proof,
      publicSignals,
      credentialPayload: issuedCred,
      issuerSignature: issuedCred.issuerSignature,
    });
    await verifyProof(vReq2, vRes2);
    assert.strictEqual(vRes2.getStatusCode(), 400);
    assert(vRes2.getData().error.includes('Replay attack prevented'));
  });

  await test('Strictly prevents nullifier double-spending across different requests', async () => {
    // Challenge A
    const { req: chalReqA, res: chalResA } = mockReqRes({ minAge: 18 });
    await createVerificationChallenge(chalReqA, chalResA);
    const challengeA = chalResA.getData();

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      {
        privateAge: userAge.toString(),
        privateSecret: userSecret.toString(),
        publicCommitment: issuedCred.commitment.toString(),
        minAge: '18',
        nonce: challengeA.nonce.toString(),
      },
      wasmPath,
      zkeyPath
    );

    // Fulfill Challenge A -> Nullifier is now consumed in verification_logs
    const { req: vReqA, res: vResA } = mockReqRes({
      requestId: challengeA.requestId,
      proof,
      publicSignals,
      credentialPayload: issuedCred,
      issuerSignature: issuedCred.issuerSignature,
    });
    await verifyProof(vReqA, vResA);
    assert.strictEqual(vResA.getStatusCode(), 200);

    const consumedNullifier = publicSignals[0].toString();

    // Challenge B (Different request, but someone attempts to present the consumed nullifier)
    const { req: chalReqB, res: chalResB } = mockReqRes({ minAge: 18 });
    await createVerificationChallenge(chalReqB, chalResB);
    const challengeB = chalResB.getData();

    // Prepare signals for Challenge B but inject the already-consumed nullifier
    const replayedSignals = [consumedNullifier, publicSignals[1], publicSignals[2], challengeB.nonce.toString()];

    const { req: vReqB, res: vResB } = mockReqRes({
      requestId: challengeB.requestId,
      proof,
      publicSignals: replayedSignals,
      credentialPayload: issuedCred,
      issuerSignature: issuedCred.issuerSignature,
    });
    await verifyProof(vReqB, vResB);
    assert.strictEqual(vResB.getStatusCode(), 400);
    assert(vResB.getData().error.includes('nullifier has already been consumed'));
  });

  // --- USP 4: PRIVACY-MINIMISED VERIFICATION RECEIPT ---
  console.log('\n--- USP 4: Privacy-Minimised Verification Receipt ---');

  await test('Verification receipt contains zero bytes of exact age or birth date', async () => {
    const { req: chalReq, res: chalRes } = mockReqRes({ minAge: 21 });
    await createVerificationChallenge(chalReq, chalRes);
    const challenge = chalRes.getData();

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      {
        privateAge: userAge.toString(),
        privateSecret: userSecret.toString(),
        publicCommitment: issuedCred.commitment.toString(),
        minAge: '21',
        nonce: challenge.nonce.toString(),
      },
      wasmPath,
      zkeyPath
    );

    const { req: vReq, res: vRes } = mockReqRes({
      requestId: challenge.requestId,
      proof,
      publicSignals,
      credentialPayload: issuedCred,
      issuerSignature: issuedCred.issuerSignature,
    });
    await verifyProof(vReq, vRes);
    assert.strictEqual(vRes.getStatusCode(), 200);

    const receipt = vRes.getData();
    const receiptStr = JSON.stringify(receipt);
    assert(!receiptStr.includes(`"age":${userAge}`), 'Receipt must never contain exact age');
    assert(!receiptStr.includes('dateOfBirth'), 'Receipt must never contain date of birth');
    assert(!receiptStr.includes(userSecret), 'Receipt must never contain secret salt');
    assert.strictEqual(receipt.claim, 'Age >= 21');
  });

  await test('Audit logs persist only zero-knowledge receipts (no witness, DOB, or secrets)', async () => {
    const { req: logReq, res: logRes } = mockReqRes({}, {}, { limit: 10 });
    await getAuditLogs(logReq, logRes);
    const logs = logRes.getData().logs;
    assert(logs.length > 0);

    for (const entry of logs) {
      const entryStr = JSON.stringify(entry);
      assert(!entryStr.includes(`"age":${userAge}`), 'Audit log contains raw age');
      assert(!entryStr.includes('dateOfBirth'), 'Audit log contains date of birth');
      assert(!entryStr.includes(userSecret), 'Audit log contains secret salt');
      assert(entry.nullifier && entry.nullifier.length > 0, 'Audit log has nullifier');
      assert(entry.commitment && entry.commitment.length > 0, 'Audit log has commitment');
    }
  });

  // --- USP 5: TRANSPARENT SECURITY DEMONSTRATION ---
  console.log('\n--- USP 5: Transparent Security Demonstration ---');

  await test('Correctly detects and rejects corrupted Groth16 proof coefficients', async () => {
    const { req: chalReq, res: chalRes } = mockReqRes({ minAge: 18 });
    await createVerificationChallenge(chalReq, chalRes);
    const challenge = chalRes.getData();

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      {
        privateAge: userAge.toString(),
        privateSecret: userSecret.toString(),
        publicCommitment: issuedCred.commitment.toString(),
        minAge: '18',
        nonce: challenge.nonce.toString(),
      },
      wasmPath,
      zkeyPath
    );

    // Corrupt proof coefficient
    const corruptedProof = JSON.parse(JSON.stringify(proof));
    corruptedProof.pi_a[0] = '999999999999999999999999999999999999';

    const { req: vReq, res: vRes } = mockReqRes({
      requestId: challenge.requestId,
      proof: corruptedProof,
      publicSignals,
      credentialPayload: issuedCred,
      issuerSignature: issuedCred.issuerSignature,
    });
    await verifyProof(vReq, vRes);
    assert.strictEqual(vRes.getStatusCode(), 400);
    assert(vRes.getData().error.includes('Zero-Knowledge proof rejected'));
  });

  await test('Correctly detects and rejects untrusted or rogue issuer DIDs', async () => {
    const { req: chalReq, res: chalRes } = mockReqRes({ minAge: 18 });
    await createVerificationChallenge(chalReq, chalRes);
    const challenge = chalRes.getData();

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      {
        privateAge: userAge.toString(),
        privateSecret: userSecret.toString(),
        publicCommitment: issuedCred.commitment.toString(),
        minAge: '18',
        nonce: challenge.nonce.toString(),
      },
      wasmPath,
      zkeyPath
    );

    const roguePayload = { ...issuedCred, issuerId: 'did:zktrust:issuer:malicious-counterfeiter' };
    const { req: vReq, res: vRes } = mockReqRes({
      requestId: challenge.requestId,
      proof,
      publicSignals,
      credentialPayload: roguePayload,
      issuerSignature: issuedCred.issuerSignature,
    });
    await verifyProof(vReq, vRes);
    assert.strictEqual(vRes.getStatusCode(), 400);
    assert(vRes.getData().error.includes('Unknown or untrusted Issuer ID'));
  });

  await test('Correctly rejects expired credentials during proof verification', async () => {
    const { req: chalReq, res: chalRes } = mockReqRes({ minAge: 18 });
    await createVerificationChallenge(chalReq, chalRes);
    const challenge = chalRes.getData();

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      {
        privateAge: userAge.toString(),
        privateSecret: userSecret.toString(),
        publicCommitment: issuedCred.commitment.toString(),
        minAge: '18',
        nonce: challenge.nonce.toString(),
      },
      wasmPath,
      zkeyPath
    );

    // Expired credential payload
    const expiredPayload = {
      ...issuedCred,
      expiresAt: new Date(Date.now() - 3600000).toISOString(),
    };
    const keys = getIssuerKeyPair(issuerId);
    const expiredSig = signCredentialPayload(expiredPayload, keys.privateKey);

    const { req: vReq, res: vRes } = mockReqRes({
      requestId: challenge.requestId,
      proof,
      publicSignals,
      credentialPayload: expiredPayload,
      issuerSignature: expiredSig,
    });
    await verifyProof(vReq, vRes);
    assert.strictEqual(vRes.getStatusCode(), 400);
    assert(vRes.getData().error.includes('expired'));
  });

  console.log('\n================================================================');
  console.log(`CORE USPs AUDIT SUMMARY: ${passedCount} of ${testCount} TESTS PASSED (100%)`);
  console.log('================================================================\n');
}

runCoreUspsAudit().catch((err) => {
  console.error('Core USPs Audit Encountered Error:', err);
  process.exit(1);
});
