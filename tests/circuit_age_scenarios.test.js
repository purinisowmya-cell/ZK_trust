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
const vkeyPath = path.join(buildDir, 'verification_key.json');

async function testAgeScenarios() {
  console.log('\n================================================================');
  console.log('       MODULE 3 TEST: REAL CIRCOM AGE-VERIFICATION CIRCUIT       ');
  console.log('       Testing Age >= 18, Age >= 21 and Age >= 25 with Groth16  ');
  console.log('================================================================\n');

  if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath) || !fs.existsSync(vkeyPath)) {
    throw new Error('Circuit build artifacts missing. Run compilation and Groth16 setup first.');
  }

  const vKey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
  const poseidon = await buildPoseidon();

  // Synthetic Test User: Age 21
  const userAge = 21;
  const userSecret = '18273645192837465192837465192837465'; // 248-bit secret
  const commitmentBytes = poseidon([BigInt(userAge), BigInt(userSecret)]);
  const userCommitment = poseidon.F.toObject(commitmentBytes).toString();

  console.log('Synthetic Identity Information:');
  console.log(' - User Genuine Age:', userAge);
  console.log(' - User Secret Salt:', userSecret.slice(0, 16) + '...');
  console.log(' - Poseidon Commitment:', userCommitment);

  let passedTests = 0;
  let totalTests = 3;

  // --------------------------------------------------------------------------
  // SCENARIO 1: Minimum Age = 18 (Expected: VALID PROOF)
  // --------------------------------------------------------------------------
  console.log('\n--- [Scenario 1] Testing Policy: Age >= 18 (User is 21) ---');
  const nonce18 = '98765432101234567890';
  const expectedNullifier18 = poseidon.F.toObject(poseidon([BigInt(userSecret), BigInt(nonce18)])).toString();

  const witness18 = {
    privateAge: userAge.toString(),
    privateSecret: userSecret,
    publicCommitment: userCommitment,
    minAge: '18',
    nonce: nonce18,
  };

  const start18 = Date.now();
  const { proof: proof18, publicSignals: signals18 } = await snarkjs.groth16.fullProve(
    witness18,
    wasmPath,
    zkeyPath
  );
  const time18 = Date.now() - start18;

  console.log(`Groth16 proof computed in ${time18}ms.`);
  console.log('Public signals output:', signals18);

  // Assert signal ordering
  const nullifierOk18 = signals18[0] === expectedNullifier18;
  const commitmentOk18 = signals18[1] === userCommitment;
  const minAgeOk18 = signals18[2] === '18';
  const nonceOk18 = signals18[3] === nonce18;

  console.log('Signal verification:');
  console.log(' - signals[0] == nullifier:', nullifierOk18);
  console.log(' - signals[1] == commitment:', commitmentOk18);
  console.log(' - signals[2] == minAge (18):', minAgeOk18);
  console.log(' - signals[3] == nonce:', nonceOk18);

  const isVerified18 = await snarkjs.groth16.verify(vKey, signals18, proof18);
  console.log('Backend Groth16 cryptographic verification:', isVerified18 ? 'VALID' : 'INVALID');

  if (isVerified18 && nullifierOk18 && commitmentOk18 && minAgeOk18 && nonceOk18) {
    console.log('[PASS] Scenario 1 (Age 21 >= 18) PASSED successfully.');
    passedTests++;
  } else {
    console.error('[FAIL] Scenario 1 failed verification!');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 2: Minimum Age = 21 (Expected: VALID PROOF - EXACT BOUNDARY)
  // --------------------------------------------------------------------------
  console.log('\n--- [Scenario 2] Testing Policy: Age >= 21 (User is 21 - Boundary Check) ---');
  const nonce21 = '87654321098765432109';
  const expectedNullifier21 = poseidon.F.toObject(poseidon([BigInt(userSecret), BigInt(nonce21)])).toString();

  const witness21 = {
    privateAge: userAge.toString(),
    privateSecret: userSecret,
    publicCommitment: userCommitment,
    minAge: '21',
    nonce: nonce21,
  };

  const start21 = Date.now();
  const { proof: proof21, publicSignals: signals21 } = await snarkjs.groth16.fullProve(
    witness21,
    wasmPath,
    zkeyPath
  );
  const time21 = Date.now() - start21;

  console.log(`Groth16 proof computed in ${time21}ms.`);
  console.log('Public signals output:', signals21);

  const isVerified21 = await snarkjs.groth16.verify(vKey, signals21, proof21);
  console.log('Backend Groth16 cryptographic verification:', isVerified21 ? 'VALID' : 'INVALID');

  if (isVerified21 && signals21[2] === '21' && signals21[0] === expectedNullifier21) {
    console.log('[PASS] Scenario 2 (Age 21 >= 21) PASSED successfully.');
    passedTests++;
  } else {
    console.error('[FAIL] Scenario 2 failed verification!');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 3: Minimum Age = 25 (Expected: INVALID - CIRCUIT REJECTION)
  // User is 21, so minAge <= privateAge (25 <= 21) is FALSE.
  // The Circom LessEqThan constraint MUST prevent witness generation.
  // --------------------------------------------------------------------------
  console.log('\n--- [Scenario 3] Testing Policy: Age >= 25 (User is 21 - Underage Check) ---');
  const nonce25 = '76543210987654321098';

  const witness25 = {
    privateAge: userAge.toString(),
    privateSecret: userSecret,
    publicCommitment: userCommitment,
    minAge: '25',
    nonce: nonce25,
  };

  let witnessGenerated25 = false;
  let circuitErrorMessage = '';

  try {
    await snarkjs.groth16.fullProve(witness25, wasmPath, zkeyPath);
    witnessGenerated25 = true;
  } catch (err) {
    witnessGenerated25 = false;
    circuitErrorMessage = err.message;
  }

  console.log('Circom Witness Generation Result:', witnessGenerated25 ? 'UNEXPECTED SUCCESS (BUG)' : 'CORRECTLY REJECTED');
  console.log('Circuit Constraint Output:', circuitErrorMessage);

  // Also test: What if an attacker tries to submit an altered public signal with proof21 claiming minAge = 25?
  const tamperedSignals25 = [...signals21];
  tamperedSignals25[2] = '25'; // Tamper public minAge claim
  const isForgeryAccepted = await snarkjs.groth16.verify(vKey, tamperedSignals25, proof21);
  console.log('Cryptographic Verifier Forgery Test (modified public signal):', isForgeryAccepted ? 'ACCEPTED (VULNERABLE)' : 'REJECTED (SECURE)');

  if (!witnessGenerated25 && !isForgeryAccepted) {
    console.log('[PASS] Scenario 3 (Age 21 attempting >= 25) REJECTED mathematically as required.');
    passedTests++;
  } else {
    console.error('[FAIL] Scenario 3 allowed underage proof or forgery!');
  }

  console.log('\n================================================================');
  console.log(`CIRCUIT TEST SUMMARY: ${passedTests} of ${totalTests} SCENARIOS PASSED.`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

testAgeScenarios().catch((err) => {
  console.error('Fatal circuit test error:', err);
  process.exit(1);
});
