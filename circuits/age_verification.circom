pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

/*
 * ZK-Trust Age Verification Circuit
 * 
 * Verifies that a user meets a minimum age threshold without revealing
 * their exact age or date of birth.
 * 
 * Signals:
 * - privateAge (private witness): The user's genuine age in years (0 - 150)
 * - privateSecret (private witness): Secure random secret embedded in credential
 * - publicCommitment (public input): Poseidon(privateAge, privateSecret) signed by Issuer
 * - minAge (public input): Verification policy minimum age (e.g. 18 or 21)
 * - nonce (public input): Per-request cryptographic challenge to prevent replay
 * - nullifier (public output): Poseidon(privateSecret, nonce) to detect duplicate submissions
 */
template AgeVerification() {
    // ------------------------------------------------------------------------
    // Signals
    // ------------------------------------------------------------------------
    signal input privateAge;
    signal input privateSecret;

    signal input publicCommitment;
    signal input minAge;
    signal input nonce;

    signal output nullifier;

    // ------------------------------------------------------------------------
    // 1. Commitment Integrity Check
    // Proves the private age and secret match the issuer-signed public commitment.
    // ------------------------------------------------------------------------
    component commitmentHasher = Poseidon(2);
    commitmentHasher.inputs[0] <== privateAge;
    commitmentHasher.inputs[1] <== privateSecret;
    commitmentHasher.out === publicCommitment;

    // ------------------------------------------------------------------------
    // 2. Range Constraints (0 <= age <= 150, 0 <= minAge <= 150)
    // LessEqThan(8) expects inputs in [0, 255]
    // ------------------------------------------------------------------------
    component ageUpperBound = LessEqThan(8);
    ageUpperBound.in[0] <== privateAge;
    ageUpperBound.in[1] <== 150;
    ageUpperBound.out === 1;

    component minAgeUpperBound = LessEqThan(8);
    minAgeUpperBound.in[0] <== minAge;
    minAgeUpperBound.in[1] <== 150;
    minAgeUpperBound.out === 1;

    // ------------------------------------------------------------------------
    // 3. Minimum Age Inequality Enforcement
    // Enforces: privateAge >= minAge  <==>  minAge <= privateAge
    // ------------------------------------------------------------------------
    component ageCheck = LessEqThan(8);
    ageCheck.in[0] <== minAge;
    ageCheck.in[1] <== privateAge;
    ageCheck.out === 1;

    // ------------------------------------------------------------------------
    // 4. Per-Request Nullifier Derivation
    // Binds privateSecret and request nonce cryptographically.
    // nullifier = Poseidon(privateSecret, nonce)
    // ------------------------------------------------------------------------
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== privateSecret;
    nullifierHasher.inputs[1] <== nonce;
    nullifier <== nullifierHasher.out;
}

// Specify public inputs explicitly.
// In Groth16, outputs are public by definition, followed by explicit public inputs.
component main {public [publicCommitment, minAge, nonce]} = AgeVerification();
