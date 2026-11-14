import fs from 'fs';
import * as snarkjs from 'snarkjs';
import { config } from '../config/index.js';

let cachedVerificationKey = null;

/**
 * Loads the circuit verification key from build artifacts.
 */
export function getVerificationKey() {
  if (!cachedVerificationKey) {
    if (!fs.existsSync(config.verification.circuitVerificationKeyPath)) {
      throw new Error(
        `Verification key not found at ${config.verification.circuitVerificationKeyPath}. Run circuit setup first.`
      );
    }
    const raw = fs.readFileSync(config.verification.circuitVerificationKeyPath, 'utf8');
    cachedVerificationKey = JSON.parse(raw);
  }
  return cachedVerificationKey;
}

/**
 * Verifies a Groth16 zero-knowledge proof against public signals and the verification key.
 * 
 * Signal Mapping:
 * - publicSignals[0]: nullifier (output)
 * - publicSignals[1]: publicCommitment (input)
 * - publicSignals[2]: minAge (input)
 * - publicSignals[3]: nonce (input)
 */
export async function verifyGroth16Proof(proof, publicSignals) {
  try {
    if (!proof || !publicSignals || !Array.isArray(publicSignals)) {
      return { isValid: false, error: 'Malformed proof or public signals payload.' };
    }

    if (publicSignals.length < 4) {
      return {
        isValid: false,
        error: `Expected 4 public signals, but received ${publicSignals.length}.`,
      };
    }

    const vKey = getVerificationKey();
    const isCryptoValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

    if (!isCryptoValid) {
      return { isValid: false, error: 'Cryptographic Groth16 proof verification failed.' };
    }

    return {
      isValid: true,
      extractedSignals: {
        nullifier: publicSignals[0].toString(),
        commitment: publicSignals[1].toString(),
        minAge: parseInt(publicSignals[2].toString(), 10),
        nonce: publicSignals[3].toString(),
      },
    };
  } catch (err) {
    return {
      isValid: false,
      error: `Proof verification exception: ${err.message}`,
    };
  }
}
