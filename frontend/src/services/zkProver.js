/**
 * ZK-Trust Client-Side Prover
 * 
 * Generates real Groth16 zero-knowledge proofs directly inside the user's browser.
 * The private witness (exact age, date of birth, secret) NEVER leaves the client.
 */

export async function generateAgeProof({ privateAge, privateSecret, publicCommitment, minAge, nonce }) {
  if (typeof window === 'undefined' || !window.snarkjs) {
    throw new Error('SnarkJS runtime not loaded in browser window. Ensure /zk/snarkjs.min.js is loaded.');
  }

  const snarkjs = window.snarkjs;

  const witnessInput = {
    privateAge: privateAge.toString(),
    privateSecret: privateSecret.toString(),
    publicCommitment: publicCommitment.toString(),
    minAge: minAge.toString(),
    nonce: nonce.toString(),
  };

  const wasmPath = '/zk/age_verification.wasm';
  const zkeyPath = '/zk/age_verification_final.zkey';

  console.log('[ZK-Prover] Initializing client-side Groth16 witness calculation...');
  const startTime = performance.now();

  try {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      witnessInput,
      wasmPath,
      zkeyPath
    );

    const duration = Math.round(performance.now() - startTime);
    console.log(`[ZK-Prover] Groth16 proof successfully generated in ${duration}ms.`);

    return {
      proof,
      publicSignals,
      executionTimeMs: duration,
      derivedNullifier: publicSignals[0],
    };
  } catch (err) {
    console.error('[ZK-Prover] Proof generation failed:', err);
    throw new Error(`Client-side proof generation failed: ${err.message}`);
  }
}
