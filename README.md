# ZK-Trust: Privacy-Preserving Digital Identity Verification Platform
> **Tagline:** *Prove What's Needed. Protect What's Private.*  
> **Theme:** Cybersecurity, FinTech and Digital Trust  
> **Zero-Knowledge Core:** Circom 2.2 + Groth16 zk-SNARKs on BN254 + Poseidon Commitments + Ed25519 Signatures + EVM Smart Contracts

---

## 1. Quick Start & Run Commands

### Prerequisites
* **Node.js:** v18.0.0 or higher (Tested on Node v24.18.0)
* **npm:** v9.0.0 or higher (Tested on npm 11.16.0)

> [!NOTE]
> On Windows 11, Port 5000 is frequently blocked or reserved by Hyper-V / WinNAT exclusions (causing `EADDRINUSE` / `EACCES`). ZK-Trust has been pre-configured to run on **Port 5001** for the backend and **Port 5173** for the Vite frontend.

### Terminal 1: Run Backend Server
```powershell
cd backend
npm run dev
```
* **Backend Endpoint:** `http://localhost:5001`
* **Health Check:** `http://localhost:5001/api/health`
* **Database Engine:** Embedded PostgreSQL (`pg-mem`) is pre-configured and active automatically with zero installation required. (Optional: point to any local or cloud PostgreSQL via `DATABASE_URL` in `backend/.env`).

### Terminal 2: Run Frontend Dashboard
```powershell
cd frontend
npm run dev
```
* **Frontend Application:** `http://localhost:5173`

---

## 2. Automated Test Commands

### Run Comprehensive 10-Feature Integration Test Suite
```powershell
node tests/advanced_features.test.js
```
* **Result:** **21 of 21 tests pass (100%)** testing all 10 features end-to-end.

### Run Circom Groth16 Age Circuit Scenarios Test
```powershell
node tests/circuit_age_scenarios.test.js
```
* **Result:** **3 of 3 scenarios pass (100%)** testing genuine Age $\ge 18$, boundary Age $\ge 21$, and mathematical rejection of underage $\ge 25$.

### Run Backend Core & Revocation Test Suite
```powershell
node tests/phase2_backend.test.js
```
* **Result:** **22 of 22 tests pass (100%)**.

---

## 3. The 10 Advanced Implemented Features

| # | Feature | Architectural Implementation | Security & Privacy Guarantees |
|---|---|---|---|
| **1** | **Student Verification System** | Colleges/universities (MIT, Stanford, etc.) issue collegiate credentials (`studentId`, `collegeName`, `department`, `course`, `graduationYear`, `enrollmentStatus`) signed with university Ed25519 keys. Students prove enrollment status for student discounts/library access. | Raw student ID numbers, full dates of birth, and academic grades remain hidden in wallet. Only verified collegiate predicate is disclosed. |
| **2** | **Age Verification Enhancement** | Dynamic age thresholds (18+, 21+, 25+, 65+, and custom policy slider) using Circom Groth16 circuit. Generates in-browser zero-knowledge proofs. | The prover mathematically proves $age \ge minAge$ and $Poseidon(age, secret) == commitment$ without revealing exact age or birthdate. |
| **3** | **Privacy-Preserving KYC** | Tier 1 (Basic ID), Tier 2 (Enhanced AML & Sanctions), and Tier 3 (Biometric Audit) issuance by compliance providers (`TrustKYC`). | Satisfies AML/FATF regulations without transmitting unencrypted passport/driver's license scans or document copies. |
| **4** | **QR-Based Identity Verification** | Interactive QR challenge session creation (`/api/verifier/qr-session`), real-time session polling, wallet camera/simulation scanning, and cryptographic proof submission. | Single-use 128-bit cryptographic nonces and anti-replay session invalidation prevent replay attacks. |
| **5** | **Multi-Issuer System** | Support for multiple accredited issuing authorities: Government Identity Authority, MIT, Stanford, TrustKYC, and WorldHuman Labs. Includes dynamic collegiate registration. | Every credential is cryptographically signed with the specific issuer's Ed25519 private key and verified using their public key. |
| **6** | **Credential Revocation** | Authorized issuers can instantly revoke compromised or graduated credentials via `/api/credentials/revoke` with recorded audit reasons. | Verifiers check revocation registries before accepting proofs. Revoked credentials trigger immediate mathematical rejection. |
| **7** | **Blockchain Issuer Registry** | EVM Solidity smart contract `contracts/IssuerRegistry.sol` for on-chain transparent public key tracking on Ethereum Sepolia / Polygon Amoy testnets with offline fallback. | Only public issuer metadata and Ed25519 public keys exist on-chain. Zero personal data, witness secrets, or credentials ever touch the blockchain. |
| **8** | **Proof of Human** | Sybil-resistant biometric liveness attestation with liveness score $\ge 95\%$ issued by WorldHuman Attestation Protocol. | Proves human uniqueness and prevents AI bot attacks without centralized identity databases or biometric leakage. |
| **9** | **Selective Disclosure** | Fine-grained predicate disclosure where users selectively approve only the requested attributes (e.g. "Enrolled: YES") while masking all other credential claims. | Verifier receives only the cryptographic attestation for the approved claim. Unapproved fields are never disclosed. |
| **10** | **Privacy Audit Logs** | Comprehensive verification audit logs filterable by date, issuer, claim type, and result (`VALID` / `REJECTED`). Includes JSON export. | Zero personally identifiable information, witness data, secrets, or birthdates are ever logged or stored. |

---

## 4. The 12 Frontend Pages & Navigation

1. **User Dashboard (`/dashboard`):** Command center displaying active wallet credentials, quick launch pads for all 10 modules, recent verification telemetry, and zero-leakage statistics.
2. **Digital Identity Wallet (`/wallet`):** Multi-credential vault (Student IDs, Civil IDs, KYC Attestations, Proof of Human) with live revocation status checks, private witness salt inspector, and QR export.
3. **Student Verification (`/student`):** Collegiate portal allowing students to prove active university enrollment for academic perks, transit discounts, and software tools.
4. **Age Verification (`/age-verification`):** Interactive threshold prover with presets (18+, 21+, 25+, 65+) and custom sliders, executing client-side Groth16 SnarkJS proofs.
5. **Privacy-Preserving KYC (`/kyc`):** Compliance portal for AML/CFT verification across Tiers 1-3 with zero document exposure.
6. **QR-Based Identity Verification (`/qr`):** Dual-mode interface featuring a Relying Party Verifier Terminal (generating interactive SVG QR codes and polling live) and a Wallet Scanner simulator.
7. **Issuer Authority Portal (`/issuer`):** Accredited issuer workstation with multi-issuer switcher (MIT, Stanford, TrustKYC, WorldHuman, Gov) and credential minting forms.
8. **Verifier Portal (`/verifier`):** Relying party verification engine with challenge creation, cryptographic Groth16 proof validation, and a tamper test lab.
9. **Credential Lifecycle & Revocation Hub (`/credentials`):** Issuer administration table to audit issued credentials and execute cryptographic revocations with recorded audit reasons.
10. **Privacy Audit Trail (`/audit`):** Transparent audit history filterable by date, issuer, claim, and outcome, complete with JSON export functionality.
11. **Blockchain-Based Issuer Registry (`/blockchain`):** On-chain transparency viewer connecting to `IssuerRegistry.sol` with smart contract addresses, transaction hashes, and EVM sync triggers.
12. **System Settings & Role Manager (`/settings`):** Persona switcher (Citizen/Student, Issuer, Verifier, Admin), EVM testnet selector, cryptographic engine status, and local wallet reset tools.

---

## 5. Cryptographic Specifications

```
                          +------------------------------------------+
                          |        Poseidon Hash Commitment          |
                          |  Commitment = Poseidon(attribute, secret)|
                          +------------------------------------------+
                                               |
                                               v
                          +------------------------------------------+
                          |       Canonical Credential Payload       |
                          | credId | issuerId | C | issued | expires |
                          +------------------------------------------+
                                               |
                                               v
                          +------------------------------------------+
                          |         Ed25519 Issuer Signature         |
                          |      Signed by Issuer Private Key        |
                          +------------------------------------------+
                                               |
                                               v
                          +------------------------------------------+
                          |      Circom 2.2 Groth16 ZK-SNARK         |
                          | Proves: Private Age >= Public MinAge     |
                          | Public: nullifier, commitment, minAge,   |
                          |         single-use challenge nonce       |
                          +------------------------------------------+
```

* **Curve:** BN254 (`alt_bn128`), scalar field $r = 21888242871839275222246405745257275088548364400416034343698204186575808495617$
* **Witness Salt:** 248-bit cryptographically secure pseudorandom scalar (`crypto.randomBytes(31)`)
* **Anti-Replay Nonce:** 128-bit cryptographic challenge nonce generated per request
* **Nullifier:** $Poseidon(secret, nonce)$ computed inside the circuit to guarantee single-use verification
* **Smart Contract:** `contracts/IssuerRegistry.sol` (Solidity `^0.8.20`) with role-based admin controls and on-chain transparency events
