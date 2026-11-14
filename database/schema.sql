-- ============================================================================
-- ZK-Trust Database Schema (PostgreSQL)
-- Privacy-Preserving Digital Identity Verification
--
-- CRITICAL PRIVACY PRINCIPLE:
-- Under NO circumstances does this schema store:
-- - Exact user age or date of birth
-- - Cryptographic secrets (salts / blinding factors)
-- - Private witness signals
-- ============================================================================

-- 1. Trusted Issuers Table
CREATE TABLE IF NOT EXISTS issuers (
    issuer_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    public_key TEXT NOT NULL,          -- Ed25519 public key in hex
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Credentials Registry (Metadata & Commitments only)
CREATE TABLE IF NOT EXISTS credentials (
    credential_id VARCHAR(64) PRIMARY KEY,
    issuer_id VARCHAR(64) NOT NULL REFERENCES issuers(issuer_id),
    commitment TEXT NOT NULL,          -- Poseidon(age, secret)
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(32) DEFAULT 'ACTIVE', -- 'ACTIVE', 'REVOKED', 'EXPIRED'
    issuer_signature TEXT NOT NULL,    -- Ed25519 signature over canonical payload
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Verification Requests (Challenges & Nonces)
CREATE TABLE IF NOT EXISTS verification_requests (
    request_id VARCHAR(64) PRIMARY KEY,
    verifier_id VARCHAR(64) NOT NULL,
    verifier_name VARCHAR(255) NOT NULL,
    purpose TEXT NOT NULL,
    min_age INTEGER NOT NULL CHECK (min_age >= 0 AND min_age <= 150),
    nonce TEXT NOT NULL UNIQUE,        -- Unique cryptographic challenge
    status VARCHAR(32) DEFAULT 'PENDING', -- 'PENDING', 'CONSUMED', 'REJECTED', 'EXPIRED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 4. Privacy-Preserving Verification Audit Logs
-- Used for anti-replay enforcement and compliance tracking
CREATE TABLE IF NOT EXISTS verification_logs (
    id SERIAL PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL,
    verifier_id VARCHAR(64) NOT NULL,
    verifier_name VARCHAR(255) NOT NULL,
    requested_claim VARCHAR(64) NOT NULL, -- e.g., 'Age >= 18'
    nullifier TEXT NOT NULL,             -- Unique nullifier from ZK circuit to prevent double-spending
    commitment TEXT NOT NULL,            -- Associated public commitment
    result VARCHAR(32) NOT NULL,         -- 'VALID', 'REJECTED'
    rejection_reason TEXT,
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indices for performance and anti-replay lookups
CREATE INDEX IF NOT EXISTS idx_requests_nonce ON verification_requests(nonce);
CREATE INDEX IF NOT EXISTS idx_logs_nullifier ON verification_logs(nullifier);
CREATE INDEX IF NOT EXISTS idx_credentials_commitment ON credentials(commitment);
