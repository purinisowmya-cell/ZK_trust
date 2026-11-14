import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const circuitsRoot = path.resolve(__dirname, '..');
const buildDir = path.resolve(circuitsRoot, 'build');

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd: circuitsRoot, stdio: 'inherit' });
}

async function main() {
  console.log('=== ZK-Trust: Groth16 Trusted Setup Ceremony ===');

  const r1cs = path.join(buildDir, 'age_verification.r1cs');
  const pot0 = path.join(buildDir, 'pot12_0000.ptau');
  const pot1 = path.join(buildDir, 'pot12_0001.ptau');
  const potFinal = path.join(buildDir, 'pot12_final.ptau');
  const zkey0 = path.join(buildDir, 'age_verification_0000.zkey');
  const zkeyFinal = path.join(buildDir, 'age_verification_final.zkey');
  const vkey = path.join(buildDir, 'verification_key.json');

  if (!fs.existsSync(r1cs)) {
    throw new Error(`R1CS file not found at ${r1cs}. Run 'npm run compile' first.`);
  }

  // 1. Powers of Tau Phase 1: New accumulator for bn128, 2^12 (4096 constraints)
  console.log('\n[1/6] Initializing Powers of Tau (bn128, 12)...');
  run(`npx snarkjs powersoftau new bn128 12 "${pot0}" -v`);

  // 2. Powers of Tau Contribution
  console.log('\n[2/6] Contributing entropy to Powers of Tau...');
  run(`npx snarkjs powersoftau contribute "${pot0}" "${pot1}" --name="ZK-Trust Contributor 1" -v -e="entropy_${Date.now()}"`);

  // 3. Prepare Phase 2
  console.log('\n[3/6] Preparing Phase 2...');
  run(`npx snarkjs powersoftau prepare phase2 "${pot1}" "${potFinal}" -v`);

  // 4. Groth16 Setup
  console.log('\n[4/6] Generating initial zkey (Groth16 setup)...');
  run(`npx snarkjs groth16 setup "${r1cs}" "${potFinal}" "${zkey0}"`);

  // 5. Contribute to Phase 2 (ZKey)
  console.log('\n[5/6] Contributing entropy to circuit-specific zkey...');
  run(`npx snarkjs zkey contribute "${zkey0}" "${zkeyFinal}" --name="ZK-Trust Verifier Contributor" -v -e="zkey_entropy_${Date.now()}"`);

  // 6. Export Verification Key
  console.log('\n[6/6] Exporting verification_key.json...');
  run(`npx snarkjs zkey export verificationkey "${zkeyFinal}" "${vkey}"`);

  // Cleanup temporary ceremony files
  console.log('\nCleaning up temporary ceremony files...');
  [pot0, pot1, zkey0].forEach(file => {
    if (fs.existsSync(file)) {
      try { fs.unlinkSync(file); } catch (e) {}
    }
  });

  console.log('\n=== Groth16 Ceremony Setup Completed Successfully! ===');
  console.log('Artifacts generated:');
  console.log(' - Verification Key:', vkey);
  console.log(' - Proving Key (zkey):', zkeyFinal);
  console.log(' - Prepared PTAU:', potFinal);
}

main().catch(err => {
  console.error('Ceremony error:', err.message);
  process.exit(1);
});
