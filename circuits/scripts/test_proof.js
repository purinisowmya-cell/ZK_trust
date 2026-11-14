import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as snarkjs from 'snarkjs';
import { buildPoseidon } from 'circomlibjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const buildDir = path.resolve(__dirname, '../build');
const wasmPath = path.join(buildDir, 'age_verification_js/age_verification.wasm');
const zkeyPath = path.join(buildDir, 'age_verification_final.zkey');
const vkeyPath = path.join(buildDir, 'verification_key.json');

async function testZKProof() {
  console.log('=== Testing Real Groth16 Proof Generation & Verification ===');

  const poseidon = await buildPoseidon();

  // Test Case 1: Legitimate adult (Age = 21, MinAge = 18)
  const age = 21;
  const secret = '123456789012345678901234567890';
  const nonce = '98765432109876543210';
  const minAge = 18;

  // Compute expected commitment & nullifier
  const commitmentBytes = poseidon([BigInt(age), BigInt(secret)]);
  const publicCommitment = poseidon.F.toObject(commitmentBytes).toString();

  const nullifierBytes = poseidon([BigInt(secret), BigInt(nonce)]);
  const expectedNullifier = poseidon.F.toObject(nullifierBytes).toString();

  console.log('Input Signals:');
  console.log(' - privateAge:', age);
  console.log(' - privateSecret:', secret);
  console.log(' - publicCommitment:', publicCommitment);
  console.log(' - minAge:', minAge);
  console.log(' - nonce:', nonce);
  console.log(' - expectedNullifier:', expectedNullifier);

  const witnessInput = {
    privateAge: age.toString(),
    privateSecret: secret,
    publicCommitment: publicCommitment,
    minAge: minAge.toString(),
    nonce: nonce,
  };

  console.log('\n[1/3] Generating Groth16 witness and proof...');
  const startTime = Date.now();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    witnessInput,
    wasmPath,
    zkeyPath
  );
  console.log(`Proof generated in ${Date.now() - startTime}ms`);
  console.log('Generated Public Signals:', publicSignals);

  // Check signal ordering:
  // publicSignals[0]: nullifier
  // publicSignals[1]: publicCommitment
  // publicSignals[2]: minAge
  // publicSignals[3]: nonce
  console.log('\nVerifying signal order:');
  console.log(' - publicSignals[0] == expectedNullifier:', publicSignals[0] === expectedNullifier);
  console.log(' - publicSignals[1] == publicCommitment:', publicSignals[1] === publicCommitment);
  console.log(' - publicSignals[2] == minAge:', publicSignals[2] === minAge.toString());
  console.log(' - publicSignals[3] == nonce:', publicSignals[3] === nonce);

  // [2/3] Verifying valid proof with verification_key
  console.log('\n[2/3] Verifying legitimate proof against verification_key.json...');
  const vKey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
  const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
  console.log('Cryptographic Verification Result:', isValid ? 'PASS (VALID)' : 'FAIL');
  if (!isValid) throw new Error('Legitimate proof failed verification!');

  // [3/3] Verifying tampered proof rejection
  console.log('\n[3/3] Testing Tamper Detection (tampered public signal)...');
  const tamperedSignals = [...publicSignals];
  tamperedSignals[2] = '25'; // Tamper minAge claim
  const isTamperedValid = await snarkjs.groth16.verify(vKey, tamperedSignals, proof);
  console.log('Tampered Verification Result:', isTamperedValid ? 'FAIL (Accepted!)' : 'PASS (REJECTED)');
  if (isTamperedValid) throw new Error('Tampered proof was unexpectedly accepted!');

  console.log('\n=== REAL CIRCOM & GROTH16 PROOF TEST PASSED 100%! ===\n');
  process.exit(0);
}

testZKProof().catch(err => {
  console.error('Proof test failed:', err);
  process.exit(1);
});
