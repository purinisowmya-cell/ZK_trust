# ZK-Trust: Threat Model & Security Analysis

## 1. Threat Vectors & Countermeasures

| # | Threat Vector | Attack Description | ZK-Trust Defense Mechanism |
| :--- | :--- | :--- | :--- |
| **T1** | **Forged Credential** | An attacker creates a synthetic credential with a fake commitment. | The backend verifies the **Ed25519 signature** of the registered issuer over the canonical payload. Untrusted or modified payloads are rejected (Test Case E & F). |
| **T2** | **Underage Impersonation** | An underage user (e.g. age 17) attempts to prove they are $\ge 18$ or $\ge 21$. | The Circom circuit enforces `LessEqThan(8)`: $\text{minAge} \le \text{age}$. Witness calculation mathematically aborts if the inequality is not met (Test Case C). |
| **T3** | **Replay Attack** | An attacker intercepts a valid proof and re-submits it to another verifier or session. | Every verification request generates a **cryptographic nonce**. The circuit derives `nullifier = Poseidon(secret, nonce)`. The backend tracks nonces and nullifiers, instantly rejecting duplicate submissions (Test Case G). |
| **T4** | **Proof Tampering** | An attacker intercepts a proof and alters public signals (e.g., claiming age $\ge 25$). | Groth16 cryptographic pairing check fails ($e(A,B) \neq \dots$), rejecting altered proofs immediately (Test Case D). |
| **T5** | **Commitment Substitution** | An attacker generates a proof for their own credential but submits someone else's signed credential. | Circuit enforces `Poseidon(age, secret) === publicCommitment`. Backend confirms `signedPayload.commitment === proof.publicSignals[1]`. |
| **T6** | **Witness Extraction** | A rogue verifier tries to inspect network traffic to discover birthdate or age. | Zero-knowledge property: Private age and secret never leave the client's browser memory. Only proof group elements $(A \in G_1, B \in G_2, C \in G_1)$ are sent. |
| **T7** | **Field Overflow Attack** | An attacker inputs negative numbers or values exceeding the field order $r$. | Strict `LessEqThan(8)` range constraints restrict both `privateAge` and `minAge` to $[0, 150]$. Field wraps are mathematically impossible. |
| **T8** | **Expired Credential Abuse** | Using a valid credential that was issued in the past but has expired. | Backend and signed canonical payload check `expiresAt >= now`. Expired credentials are automatically rejected (Test Case H). |

---

## 2. Privacy-Preserving Audit Trail Guarantee

Under the ZK-Trust protocol:
- **Never stored:** User names, Date of Birth, exact Age, Government ID numbers, Private secrets, Witness signals.
- **Stored for compliance:** Request ID, Verifier Name, Policy Claim (`Age >= 18`), Nullifier, Verification Result (`VALID` / `REJECTED`), Timestamp.
