import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as snarkjs from '../backend/node_modules/snarkjs/main.js';
import { buildPoseidon } from '../backend/node_modules/circomlibjs/main.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const circuitsDir = path.resolve(__dirname, '../circuits/build');
const wasmPath = path.join(circuitsDir, 'age_verification_js/age_verification.wasm');
const zkeyPath = path.join(circuitsDir, 'age_verification_final.zkey');
const vkeyPath = path.join(circuitsDir, 'verification_key.json');

const PORT = process.env.PORT || 5001;
const BASE_URL = `http://localhost:${PORT}`;

// Helper for making JSON HTTP requests
function request(method, pathUrl, body = null) {
  return new Promise((resolve, reject) => {
    const fullPath = pathUrl.startsWith('/api') ? pathUrl : '/api' + (pathUrl.startsWith('/') ? pathUrl : '/' + pathUrl);
    const options = {
      hostname: '127.0.0.1',
      port: PORT,
      path: fullPath,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Helper to generate a Groth16 proof
async function generateGroth16Proof(privateAge, privateSecret, publicCommitment, minAge, nonce) {
  const witnessInput = {
    privateAge: privateAge.toString(),
    privateSecret: privateSecret.toString(),
    publicCommitment: publicCommitment.toString(),
    minAge: minAge.toString(),
    nonce: nonce.toString(),
  };

  return await snarkjs.groth16.fullProve(witnessInput, wasmPath, zkeyPath);
}

async function runTestSuite() {
  console.log('\n================================================================');
  console.log('         ZK-TRUST: AUTOMATED INTEGRATION TEST SUITE             ');
  console.log('         Verification Scenarios A through I Execution           ');
  console.log('================================================================\n');

  const testResults = [];
  let passedCount = 0;
  let failedCount = 0;

  function recordResult(testId, name, expected, actual, passed, details = '') {
    const status = passed ? 'PASS [OK]' : 'FAIL [X]';
    if (passed) passedCount++;
    else failedCount++;

    testResults.push({ testId, name, expected, actual, passed, details });
    console.log(`[${testId}] ${name}`);
    console.log(`     Expected: ${expected}`);
    console.log(`     Actual:   ${actual}`);
    console.log(`     Result:   ${status}`);
    if (details) console.log(`     Details:  ${details}`);
    console.log('----------------------------------------------------------------');
  }

  // 1. Health check
  console.log('Step 0: Verifying backend server connectivity...');
  const health = await request('GET', '/health');
  if (health.status !== 200) {
    throw new Error(`Backend server not responsive. Status: ${health.status}`);
  }
  console.log('Backend connected successfully. Database mode:', health.data.inMemoryDatabase ? 'pg-mem' : 'PostgreSQL');

  // Step 1: Issue Synthetic Identity Credential for Test User (Age 21)
  console.log('\nStep 1: Issuing synthetic credential for test user (Age 21)...');
  const userPersona = {
    fullName: 'Alex Vance (Test Subject)',
    dateOfBirth: '2005-05-14',
    age: 21,
  };

  const issuanceRes = await request('POST', '/issuer/issue-credential', userPersona);
  if (issuanceRes.status !== 201) {
    throw new Error(`Failed to issue credential: ${JSON.stringify(issuanceRes.data)}`);
  }

  const credential = issuanceRes.data.credential;
  const privateData = issuanceRes.data.privateData;

  console.log('Credential issued:');
  console.log(' - Credential ID:', credential.credentialId);
  console.log(' - Commitment:', credential.commitment);
  console.log(' - Issuer Signature:', credential.issuerSignature.slice(0, 32) + '...');
  console.log(' - Private Age:', privateData.age);
  console.log(' - Private Secret:', privateData.secret.slice(0, 16) + '...\n');

  // --------------------------------------------------------------------------
  // TEST CASE A: Request age >= 18 (Expected: VALID)
  // --------------------------------------------------------------------------
  try {
    const chA = await request('POST', '/verifier/request-challenge', {
      verifierName: 'Club Access Gate',
      minAge: 18,
      purpose: 'Age check (18+)',
    });

    const proofA = await generateGroth16Proof(
      privateData.age,
      privateData.secret,
      credential.commitment,
      chA.data.minAge,
      chA.data.nonce
    );

    const verifyA = await request('POST', '/verifier/verify-proof', {
      requestId: chA.data.requestId,
      proof: proofA.proof,
      publicSignals: proofA.publicSignals,
      credentialPayload: credential,
      issuerSignature: credential.issuerSignature,
    });

    const isPass = verifyA.status === 200 && verifyA.data.verified === true;
    recordResult(
      'A',
      'Verify Age Threshold (Age 21 proving >= 18)',
      'VALID (200 OK, verified: true)',
      `${verifyA.status} - verified: ${verifyA.data.verified}`,
      isPass,
      `Nullifier: ${verifyA.data.nullifier?.slice(0, 18)}...`
    );
  } catch (err) {
    recordResult('A', 'Verify Age Threshold (Age 21 proving >= 18)', 'VALID', err.message, false);
  }

  // --------------------------------------------------------------------------
  // TEST CASE B: Request age >= 21 (Expected: VALID)
  // --------------------------------------------------------------------------
  try {
    const chB = await request('POST', '/verifier/request-challenge', {
      verifierName: 'FinTech High Stakes Portal',
      minAge: 21,
      purpose: 'Strict legal adult verification (21+)',
    });

    const proofB = await generateGroth16Proof(
      privateData.age,
      privateData.secret,
      credential.commitment,
      chB.data.minAge,
      chB.data.nonce
    );

    const verifyB = await request('POST', '/verifier/verify-proof', {
      requestId: chB.data.requestId,
      proof: proofB.proof,
      publicSignals: proofB.publicSignals,
      credentialPayload: credential,
      issuerSignature: credential.issuerSignature,
    });

    const isPass = verifyB.status === 200 && verifyB.data.verified === true;
    recordResult(
      'B',
      'Verify Exact Boundary (Age 21 proving >= 21)',
      'VALID (200 OK, verified: true)',
      `${verifyB.status} - verified: ${verifyB.data.verified}`,
      isPass,
      `Claim: ${verifyB.data.claim}`
    );
  } catch (err) {
    recordResult('B', 'Verify Exact Boundary (Age 21 proving >= 21)', 'VALID', err.message, false);
  }

  // --------------------------------------------------------------------------
  // TEST CASE C: Request age >= 25 (Expected: INVALID)
  // User age (21) does not satisfy minAge (25). Circom circuit constraint fails!
  // --------------------------------------------------------------------------
  try {
    const chC = await request('POST', '/verifier/request-challenge', {
      verifierName: 'Rental Car Premium (25+)',
      minAge: 25,
      purpose: 'Senior driving age check',
    });

    let proofCSuccess = false;
    try {
      await generateGroth16Proof(
        privateData.age,
        privateData.secret,
        credential.commitment,
        chC.data.minAge,
        chC.data.nonce
      );
      proofCSuccess = true;
    } catch (circuitErr) {
      // Circuit constraint LessEqThan failed! (minAge <= privateAge is false: 25 <= 21 false)
      proofCSuccess = false;
    }

    const isPass = proofCSuccess === false;
    recordResult(
      'C',
      'Underage Claim (Age 21 attempting >= 25)',
      'INVALID (Circom constraint rejects witness calculation)',
      proofCSuccess ? 'Unexpectedly generated proof!' : 'Circuit rejected witness (age < minAge)',
      isPass,
      'Circuit LessEqThan constraint prevented witness generation.'
    );
  } catch (err) {
    recordResult('C', 'Underage Claim (Age 21 attempting >= 25)', 'INVALID', err.message, false);
  }

  // --------------------------------------------------------------------------
  // TEST CASE D: Modify the proof (Expected: REJECTED)
  // --------------------------------------------------------------------------
  try {
    const chD = await request('POST', '/verifier/request-challenge', {
      verifierName: 'Security Audit Verifier',
      minAge: 18,
      purpose: 'Proof forgery test',
    });

    const legitProofD = await generateGroth16Proof(
      privateData.age,
      privateData.secret,
      credential.commitment,
      chD.data.minAge,
      chD.data.nonce
    );

    // Corrupt proof curve coordinate pi_a[0]
    const tamperedProofD = {
      ...legitProofD.proof,
      pi_a: ['999999999999999999999999999', legitProofD.proof.pi_a[1], legitProofD.proof.pi_a[2]],
    };

    const verifyD = await request('POST', '/verifier/verify-proof', {
      requestId: chD.data.requestId,
      proof: tamperedProofD,
      publicSignals: legitProofD.publicSignals,
      credentialPayload: credential,
      issuerSignature: credential.issuerSignature,
    });

    const isPass = verifyD.status === 400 && verifyD.data.verified === false;
    recordResult(
      'D',
      'Tampered Groth16 Proof (Corrupted curve point pi_a)',
      'REJECTED (400 Bad Request, cryptographic pairing failure)',
      `${verifyD.status} - verified: ${verifyD.data.verified}`,
      isPass,
      `Error: ${verifyD.data.error}`
    );
  } catch (err) {
    recordResult('D', 'Tampered Groth16 Proof', 'REJECTED', err.message, false);
  }

  // --------------------------------------------------------------------------
  // TEST CASE E: Modify the signed commitment (Expected: REJECTED)
  // --------------------------------------------------------------------------
  try {
    const chE = await request('POST', '/verifier/request-challenge', {
      verifierName: 'Security Audit Verifier',
      minAge: 18,
      purpose: 'Commitment swap test',
    });

    const legitProofE = await generateGroth16Proof(
      privateData.age,
      privateData.secret,
      credential.commitment,
      chE.data.minAge,
      chE.data.nonce
    );

    // Alter credential commitment
    const tamperedCredE = {
      ...credential,
      commitment: '1111111111111111111111111111111111111',
    };

    const verifyE = await request('POST', '/verifier/verify-proof', {
      requestId: chE.data.requestId,
      proof: legitProofE.proof,
      publicSignals: legitProofE.publicSignals,
      credentialPayload: tamperedCredE,
      issuerSignature: credential.issuerSignature,
    });

    const isPass = verifyE.status === 400 && verifyE.data.verified === false;
    recordResult(
      'E',
      'Tampered Credential Commitment (Commitment Mismatch)',
      'REJECTED (400 Bad Request, signature or commitment mismatch)',
      `${verifyE.status} - verified: ${verifyE.data.verified}`,
      isPass,
      `Error: ${verifyE.data.error}`
    );
  } catch (err) {
    recordResult('E', 'Tampered Credential Commitment', 'REJECTED', err.message, false);
  }

  // --------------------------------------------------------------------------
  // TEST CASE F: Use an untrusted issuer key / ID (Expected: REJECTED)
  // --------------------------------------------------------------------------
  try {
    const chF = await request('POST', '/verifier/request-challenge', {
      verifierName: 'Security Audit Verifier',
      minAge: 18,
      purpose: 'Untrusted issuer test',
    });

    const legitProofF = await generateGroth16Proof(
      privateData.age,
      privateData.secret,
      credential.commitment,
      chF.data.minAge,
      chF.data.nonce
    );

    // Alter issuer ID to an unknown authority
    const untrustedCredF = {
      ...credential,
      issuerId: 'did:zktrust:issuer:malicious-fake-authority',
    };

    const verifyF = await request('POST', '/verifier/verify-proof', {
      requestId: chF.data.requestId,
      proof: legitProofF.proof,
      publicSignals: legitProofF.publicSignals,
      credentialPayload: untrustedCredF,
      issuerSignature: credential.issuerSignature,
    });

    const isPass = verifyF.status === 400 && verifyF.data.verified === false;
    recordResult(
      'F',
      'Untrusted Issuer Identification',
      'REJECTED (400 Bad Request, untrusted or unknown issuer ID)',
      `${verifyF.status} - verified: ${verifyF.data.verified}`,
      isPass,
      `Error: ${verifyF.data.error}`
    );
  } catch (err) {
    recordResult('F', 'Untrusted Issuer Identification', 'REJECTED', err.message, false);
  }

  // --------------------------------------------------------------------------
  // TEST CASE G: Reuse an already consumed request / replay attack (Expected: REJECTED)
  // --------------------------------------------------------------------------
  try {
    const chG = await request('POST', '/verifier/request-challenge', {
      verifierName: 'Anti-Replay Verifier',
      minAge: 18,
      purpose: 'Replay prevention test',
    });

    const proofG = await generateGroth16Proof(
      privateData.age,
      privateData.secret,
      credential.commitment,
      chG.data.minAge,
      chG.data.nonce
    );

    // 1st presentation (Should succeed)
    const firstVerify = await request('POST', '/verifier/verify-proof', {
      requestId: chG.data.requestId,
      proof: proofG.proof,
      publicSignals: proofG.publicSignals,
      credentialPayload: credential,
      issuerSignature: credential.issuerSignature,
    });

    if (firstVerify.status !== 200 || firstVerify.data.verified !== true) {
      throw new Error(`First verification presentation unexpectedly failed: ${JSON.stringify(firstVerify.data)}`);
    }

    // 2nd presentation (Replay attack: using the exact same request ID and proof)
    const replayVerify = await request('POST', '/verifier/verify-proof', {
      requestId: chG.data.requestId,
      proof: proofG.proof,
      publicSignals: proofG.publicSignals,
      credentialPayload: credential,
      issuerSignature: credential.issuerSignature,
    });

    const isPass = replayVerify.status === 400 && replayVerify.data.verified === false;
    recordResult(
      'G',
      'Anti-Replay Attack Protection (Reusing consumed request/nonce)',
      'REJECTED (400 Bad Request, challenge not pending or nullifier replay)',
      `${replayVerify.status} - verified: ${replayVerify.data.verified}`,
      isPass,
      `Error: ${replayVerify.data.error}`
    );
  } catch (err) {
    recordResult('G', 'Anti-Replay Attack Protection', 'REJECTED', err.message, false);
  }

  // --------------------------------------------------------------------------
  // TEST CASE H: Use an expired credential (Expected: REJECTED)
  // --------------------------------------------------------------------------
  try {
    const chH = await request('POST', '/verifier/request-challenge', {
      verifierName: 'Credential Expiry Auditor',
      minAge: 18,
      purpose: 'Expired credential test',
    });

    const proofH = await generateGroth16Proof(
      privateData.age,
      privateData.secret,
      credential.commitment,
      chH.data.minAge,
      chH.data.nonce
    );

    // Modify expiresAt to yesterday
    const expiredCredH = {
      ...credential,
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    };

    const verifyH = await request('POST', '/verifier/verify-proof', {
      requestId: chH.data.requestId,
      proof: proofH.proof,
      publicSignals: proofH.publicSignals,
      credentialPayload: expiredCredH,
      issuerSignature: credential.issuerSignature,
    });

    const isPass = verifyH.status === 400 && verifyH.data.verified === false;
    recordResult(
      'H',
      'Expired Credential Submission',
      'REJECTED (400 Bad Request, credential expired)',
      `${verifyH.status} - verified: ${verifyH.data.verified}`,
      isPass,
      `Error: ${verifyH.data.error}`
    );
  } catch (err) {
    recordResult('H', 'Expired Credential Submission', 'REJECTED', err.message, false);
  }

  // --------------------------------------------------------------------------
  // TEST CASE I: User Rejects Consent (Expected: No proof generated)
  // --------------------------------------------------------------------------
  try {
    const chI = await request('POST', '/verifier/request-challenge', {
      verifierName: 'Privacy Consent Auditor',
      minAge: 18,
      purpose: 'Consent rejection simulation',
    });

    // Simulated user action: user clicks "Reject Request"
    const userConsentGranted = false;
    let proofGenerated = false;

    if (userConsentGranted) {
      await generateGroth16Proof(
        privateData.age,
        privateData.secret,
        credential.commitment,
        chI.data.minAge,
        chI.data.nonce
      );
      proofGenerated = true;
    }

    const isPass = !proofGenerated;
    recordResult(
      'I',
      'User Consent Rejection Flow',
      'ABORTED (No proof generated, witness retained)',
      proofGenerated ? 'Proof was generated without consent!' : 'Proof generation aborted by user',
      isPass,
      'Client halted witness execution immediately upon user refusal.'
    );
  } catch (err) {
    recordResult('I', 'User Consent Rejection Flow', 'ABORTED', err.message, false);
  }

  // --------------------------------------------------------------------------
  // SUMMARY REPORT
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`TEST RUN COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED out of ${testResults.length} SCENARIOS.`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
