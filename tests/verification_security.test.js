import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as snarkjs from '../backend/node_modules/snarkjs/main.js';
import { buildPoseidon } from '../backend/node_modules/circomlibjs/main.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const buildDir = path.resolve(__dirname, '../circuits/build');
const wasmPath = path.join(buildDir, 'age_verification_js/age_verification.wasm');
const zkeyPath = path.join(buildDir, 'age_verification_final.zkey');

const PORT = process.env.PORT || 5001;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: path.startsWith('/api') ? path : '/api' + path,
        method,
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runVerificationSecurityTests() {
  console.log('\n================================================================');
  console.log('       MODULE 4 & 5 TEST: CONSENT & VERIFICATION SECURITY       ');
  console.log('       Rigorous Testing of Replay, Tampering & Privacy Checks    ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function record(testName, expected, actual, isPass, detail = '') {
    const status = isPass ? 'PASS [OK]' : 'FAIL [X]';
    if (isPass) passed++;
    else failed++;

    console.log(`[${status}] ${testName}`);
    console.log(`       Expected: ${expected}`);
    console.log(`       Actual:   ${actual}`);
    if (detail) console.log(`       Detail:   ${detail}`);
    console.log('----------------------------------------------------------------');
  }

  const poseidon = await buildPoseidon();

  // 1. Issue Legitimate Credential for Synthetic User (Age 21)
  console.log('Setting up: Issuing synthetic credential (Age 21)...');
  const issueRes = await request('POST', '/issuer/issue-credential', {
    fullName: 'Sophia Bennett',
    age: 21,
    dateOfBirth: '2005-04-12',
  });

  const credential = issueRes.data.credential;
  const privateData = issueRes.data.privateData;

  // Helper to generate a legitimate proof
  async function createProof(minAge, nonce) {
    const witness = {
      privateAge: privateData.age.toString(),
      privateSecret: privateData.secret,
      publicCommitment: credential.commitment,
      minAge: minAge.toString(),
      nonce: nonce.toString(),
    };
    return await snarkjs.groth16.fullProve(witness, wasmPath, zkeyPath);
  }

  // --------------------------------------------------------------------------
  // TEST 1: Legitimate Verification Challenge & Approval Flow
  // --------------------------------------------------------------------------
  console.log('\n1. Testing Legitimate Challenge Creation & Proof Verification...');
  const ch1 = await request('POST', '/verifier/request-challenge', {
    verifierName: 'Secured Banking Gateway',
    purpose: 'Age confirmation (18+)',
    minAge: 18,
  });

  const proof1 = await createProof(ch1.data.minAge, ch1.data.nonce);
  const verify1 = await request('POST', '/verifier/verify-proof', {
    requestId: ch1.data.requestId,
    proof: proof1.proof,
    publicSignals: proof1.publicSignals,
    credentialPayload: credential,
    issuerSignature: credential.issuerSignature,
  });

  const pass1 = verify1.status === 200 && verify1.data.verified === true;
  record(
    'Legitimate Verification Approval',
    'Status 200, verified: true',
    `Status ${verify1.status}, verified: ${verify1.data.verified}`,
    pass1,
    `Nullifier: ${verify1.data.nullifier?.slice(0, 16)}...`
  );

  // --------------------------------------------------------------------------
  // TEST 2: Tampered Groth16 Proof (Modified Proof Coordinate)
  // --------------------------------------------------------------------------
  console.log('\n2. Testing Tampered Proof (Cryptographic Forgery)...');
  const ch2 = await request('POST', '/verifier/request-challenge', {
    verifierName: 'Security Gate',
    minAge: 18,
  });

  const proof2 = await createProof(ch2.data.minAge, ch2.data.nonce);
  // Corrupt curve point coordinate
  const corruptedProof = {
    ...proof2.proof,
    pi_a: ['888888888888888888888888', proof2.proof.pi_a[1], proof2.proof.pi_a[2]],
  };

  const verify2 = await request('POST', '/verifier/verify-proof', {
    requestId: ch2.data.requestId,
    proof: corruptedProof,
    publicSignals: proof2.publicSignals,
    credentialPayload: credential,
    issuerSignature: credential.issuerSignature,
  });

  const pass2 = verify2.status === 400 && verify2.data.verified === false;
  record(
    'Tampered Groth16 Proof Detection',
    'Status 400, verified: false (pairing failure)',
    `Status ${verify2.status}, verified: ${verify2.data.verified}`,
    pass2,
    `Error: ${verify2.data.error}`
  );

  // --------------------------------------------------------------------------
  // TEST 3: Mismatched Commitment in Credential vs Proof
  // --------------------------------------------------------------------------
  console.log('\n3. Testing Mismatched Commitment Detection...');
  const ch3 = await request('POST', '/verifier/request-challenge', {
    verifierName: 'Security Gate',
    minAge: 18,
  });

  const proof3 = await createProof(ch3.data.minAge, ch3.data.nonce);
  const mismatchedCred = {
    ...credential,
    commitment: '123456789012345678901234567890', // Modified commitment
  };

  const verify3 = await request('POST', '/verifier/verify-proof', {
    requestId: ch3.data.requestId,
    proof: proof3.proof,
    publicSignals: proof3.publicSignals,
    credentialPayload: mismatchedCred,
    issuerSignature: credential.issuerSignature,
  });

  const pass3 = verify3.status === 400 && verify3.data.verified === false;
  record(
    'Mismatched Commitment Detection',
    'Status 400, verified: false (signature or commitment mismatch)',
    `Status ${verify3.status}, verified: ${verify3.data.verified}`,
    pass3,
    `Error: ${verify3.data.error}`
  );

  // --------------------------------------------------------------------------
  // TEST 4: Untrusted Issuer ID / Key
  // --------------------------------------------------------------------------
  console.log('\n4. Testing Untrusted / Rogue Issuer Detection...');
  const ch4 = await request('POST', '/verifier/request-challenge', {
    verifierName: 'Security Gate',
    minAge: 18,
  });

  const proof4 = await createProof(ch4.data.minAge, ch4.data.nonce);
  const rogueCred = {
    ...credential,
    issuerId: 'did:zktrust:untrusted:rogue-authority-666',
  };

  const verify4 = await request('POST', '/verifier/verify-proof', {
    requestId: ch4.data.requestId,
    proof: proof4.proof,
    publicSignals: proof4.publicSignals,
    credentialPayload: rogueCred,
    issuerSignature: credential.issuerSignature,
  });

  const pass4 = verify4.status === 400 && verify4.data.verified === false;
  record(
    'Untrusted Issuer Detection',
    'Status 400, verified: false (unknown issuer)',
    `Status ${verify4.status}, verified: ${verify4.data.verified}`,
    pass4,
    `Error: ${verify4.data.error}`
  );

  // --------------------------------------------------------------------------
  // TEST 5: Replay Attack (Re-submitting Already Consumed Request)
  // --------------------------------------------------------------------------
  console.log('\n5. Testing Anti-Replay Protection...');
  // ch1 was already consumed in Test 1!
  const replayVerify = await request('POST', '/verifier/verify-proof', {
    requestId: ch1.data.requestId,
    proof: proof1.proof,
    publicSignals: proof1.publicSignals,
    credentialPayload: credential,
    issuerSignature: credential.issuerSignature,
  });

  const pass5 = replayVerify.status === 400 && replayVerify.data.verified === false;
  record(
    'Anti-Replay Attack Protection',
    'Status 400, verified: false (challenge already consumed / replay prevented)',
    `Status ${replayVerify.status}, verified: ${replayVerify.data.verified}`,
    pass5,
    `Error: ${replayVerify.data.error}`
  );

  // --------------------------------------------------------------------------
  // TEST 6: Expired Credential Rejection
  // --------------------------------------------------------------------------
  console.log('\n6. Testing Expired Credential Rejection...');
  const ch6 = await request('POST', '/verifier/request-challenge', {
    verifierName: 'Expiry Gate',
    minAge: 18,
  });

  const proof6 = await createProof(ch6.data.minAge, ch6.data.nonce);
  const expiredCred = {
    ...credential,
    expiresAt: '2020-01-01T00:00:00.000Z', // Expired 6 years ago
  };

  const verify6 = await request('POST', '/verifier/verify-proof', {
    requestId: ch6.data.requestId,
    proof: proof6.proof,
    publicSignals: proof6.publicSignals,
    credentialPayload: expiredCred,
    issuerSignature: credential.issuerSignature,
  });

  const pass6 = verify6.status === 400 && verify6.data.verified === false;
  record(
    'Expired Credential Rejection',
    'Status 400, verified: false (credential expired)',
    `Status ${verify6.status}, verified: ${verify6.data.verified}`,
    pass6,
    `Error: ${verify6.data.error}`
  );

  // --------------------------------------------------------------------------
  // TEST 7: Zero Private Data Leakage in Audit Logs
  // --------------------------------------------------------------------------
  console.log('\n7. Verifying Audit Log Privacy (Zero Witness Leakage)...');
  const auditRes = await request('GET', '/verifier/audit-logs');
  const logs = auditRes.data.logs || [];
  
  let privateDataFoundInLogs = false;
  for (const log of logs) {
    const logString = JSON.stringify(log).toLowerCase();
    // Check if birthdate, exact age 21, or secret was logged
    if (
      logString.includes('2005-04-12') ||
      logString.includes(privateData.secret) ||
      logString.includes('"age":21') ||
      logString.includes('privateage')
    ) {
      privateDataFoundInLogs = true;
      break;
    }
  }

  const pass7 = !privateDataFoundInLogs && logs.length > 0;
  record(
    'Privacy-Preserving Audit Trail Guarantee',
    'Audit logs contain only nonces/nullifiers/claims, NO exact age/DOB/secret',
    privateDataFoundInLogs ? 'LEAKED private data!' : 'Zero witness signals stored',
    pass7,
    `Checked ${logs.length} audit records. Privacy confirmed.`
  );

  console.log('\n================================================================');
  console.log(`SECURITY SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED out of ${passed + failed} TESTS.`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runVerificationSecurityTests().catch((err) => {
  console.error('Fatal security test error:', err);
  process.exit(1);
});
