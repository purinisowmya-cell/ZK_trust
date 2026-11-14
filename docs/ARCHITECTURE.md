# ZK-Trust: System Architecture & Cryptographic Blueprint

**Theme:** Cybersecurity, FinTech and Digital Trust  
**Hackathon:** Hack With Aditya 2026  
**Tagline:** *Prove What's Needed. Protect What's Private.*

---

## 1. Executive Overview

ZK-Trust is a decentralized digital identity verification application utilizing Zero-Knowledge Proofs (ZKPs) and modern asymmetric cryptography. It allows a credential holder to cryptographically prove that they meet an age threshold ($\ge 18$ or $\ge 21$) without exposing their exact date of birth, age, or identity documents to any third party.

---

## 2. High-Level System Architecture

```
+---------------------------------------------------------------------------------------+
|                                     ZK-TRUST SYSTEM                                   |
+---------------------------------------------------------------------------------------+
|                                                                                       |
|   1. ISSUER AUTHORITY                                                                 |
|   +-------------------------------------------------------------------------------+   |
|   |  - Accepts identity information (e.g., date of birth, age)                    |   |
|   |  - Generates cryptographically secure random secret S in BN254 scalar field   |   |
|   |  - Computes Poseidon(Age, S) -> Commitment C                                  |   |
|   |  - Canonical Serializer: CredentialId | IssuerId | C | IssuedAt | ExpiresAt   |   |
|   |  - Signs payload using Ed25519 Private Key                                    |   |
|   |  - Delivers { Credential, PrivateData } to Citizen Wallet                     |   |
|   +-------------------------------------------------------------------------------+   |
|                                         |                                             |
|                                         v                                             |
|   2. CITIZEN BROWSER WALLET                                                           |
|   +-------------------------------------------------------------------------------+   |
|   |  - Securely stores { Credential, Age, Secret } in client memory               |   |
|   |  - Receives Verification Challenge { RequestId, Nonce, MinAge }               |   |
|   |  - Displays Interactive Consent Screen (What is shared vs. kept private)       |   |
|   |  - Prover Engine (snarkjs + WebAssembly Circuit):                             |   |
|   |      * Inputs: Private { Age, Secret }, Public { Commitment, MinAge, Nonce }  |   |
|   |      * Generates Groth16 Proof (A, B, C) + Public Signals                     |   |
|   |      * Private witness NEVER touches the network                              |   |
|   +-------------------------------------------------------------------------------+   |
|                                         |                                             |
|                                         v                                             |
|   3. VERIFIER & BACKEND ENGINE                                                        |
|   +-------------------------------------------------------------------------------+   |
|   |  - Challenge Registry: Nonce creation and single-use status tracking          |   |
|   |  - Verification Checks:                                                       |   |
|   |      1. Verify Ed25519 Issuer signature on canonical payload                  |   |
|   |      2. Verify signed Commitment == ZK public signal commitment               |   |
|   |      3. Verify Nonce == Challenge Nonce & Request is PENDING                  |   |
|   |      4. Check Nullifier not in consumed registry (anti-replay)                |   |
|   |      5. Verify Groth16 cryptographic pairings e(A,B) == ...                   |   |
|   |  - Consumes Nonce, records privacy-safe audit record                          |   |
|   +-------------------------------------------------------------------------------+   |
|                                                                                       |
+---------------------------------------------------------------------------------------+
```

---

## 3. Cryptographic Primitives

### 3.1 BN254 Elliptic Curve & Groth16 zk-SNARK
* **Curve:** Barreto-Naehrig curve `BN254` (also known as `alt_bn128`), supporting optimal Ate pairings.
* **Proving System:** Groth16 zero-knowledge succinct non-interactive argument of knowledge.
* **Soundness & Zero-Knowledge:**
  $$\mathcal{V}(vk, \vec{x}, \pi) \iff e(A, B) = e(\alpha, \beta) \cdot e\left(\sum_{i=0}^l x_i \cdot \gamma_i, \delta\right) \cdot e(C, \delta)$$
  Verifier learns only that there exists a valid witness satisfying the quadratic arithmetic program (QAP).

### 3.2 Poseidon Hash Function
* **Field:** BN254 scalar field $\mathbb{F}_r$ ($r \approx 2.1888 \times 10^{77}$).
* **Properties:** Algebraic S-box $x^5$, optimized for zero-knowledge arithmetic circuits (minimal $R1CS$ constraints: only $\sim 513$ non-linear constraints for the entire age circuit).

### 3.3 Ed25519 Digital Signatures
* High-speed, deterministic elliptic-curve signatures on Curve25519.
* Prevents forged credentials: only credentials signed by a registered issuer key are accepted.

---

## 4. Circom Circuit Signal Architecture

File: `circuits/age_verification.circom`

```
Private Inputs:
  - privateAge: 8-bit constrained integer [0, 150]
  - privateSecret: 248-bit blinding factor in BN254 field

Public Inputs:
  - publicCommitment: Poseidon(privateAge, privateSecret)
  - minAge: Required threshold (e.g. 18 or 21)
  - nonce: 128-bit verifier challenge

Public Outputs:
  - nullifier: Poseidon(privateSecret, nonce)
```

### Strict Public Signals Ordering
In SnarkJS:
1. `publicSignals[0]`: `nullifier`
2. `publicSignals[1]`: `publicCommitment`
3. `publicSignals[2]`: `minAge`
4. `publicSignals[3]`: `nonce`
