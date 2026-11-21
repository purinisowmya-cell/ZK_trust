-- ============================================================================
-- ZK-Trust Extended Database Schema (PostgreSQL & pg-mem compatible)
-- Privacy-Preserving Digital Identity Verification
--
-- CRITICAL PRIVACY PRINCIPLE:
-- Under NO circumstances does this schema store:
-- - Exact user age or date of birth
-- - Plaintext student ID numbers, passport/national ID numbers
-- - Cryptographic secrets (salts / blinding factors)
-- - Private witness signals
-- ============================================================================

-- 1. Organizations Table (Universities, Banks, KYC Providers, Attesters)
CREATE TABLE IF NOT EXISTS organizations (
    org_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    org_type VARCHAR(64) NOT NULL, -- 'UNIVERSITY', 'GOVERNMENT', 'KYC_PROVIDER', 'HUMAN_ATTESTER'
    contact_email VARCHAR(255),
    website VARCHAR(255),
    is_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Trusted Issuers Table (Multi-Issuer System)
CREATE TABLE IF NOT EXISTS issuers (
    issuer_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    public_key TEXT NOT NULL,          -- Ed25519 public key in PEM format
    org_id VARCHAR(64) REFERENCES organizations(org_id),
    issuer_type VARCHAR(64) DEFAULT 'GOVERNMENT', -- 'GOVERNMENT', 'UNIVERSITY', 'KYC_PROVIDER', 'HUMAN_PROVIDER'
    description TEXT,
    onchain_address VARCHAR(128),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Base Credentials Registry (Metadata & Commitments only)
CREATE TABLE IF NOT EXISTS credentials (
    credential_id VARCHAR(64) PRIMARY KEY,
    issuer_id VARCHAR(64) NOT NULL REFERENCES issuers(issuer_id),
    credential_type VARCHAR(64) DEFAULT 'AGE', -- 'AGE', 'STUDENT', 'KYC', 'HUMAN'
    commitment TEXT NOT NULL,          -- Poseidon(attributes, secret)
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(32) DEFAULT 'ACTIVE', -- 'ACTIVE', 'REVOKED', 'EXPIRED'
    issuer_signature TEXT NOT NULL,    -- Ed25519 signature over canonical payload
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Student Credentials Registry
CREATE TABLE IF NOT EXISTS student_credentials (
    credential_id VARCHAR(64) PRIMARY KEY REFERENCES credentials(credential_id),
    institution_id VARCHAR(64) NOT NULL REFERENCES issuers(issuer_id),
    student_id_hash TEXT NOT NULL,
    department VARCHAR(128) NOT NULL,
    course VARCHAR(128) NOT NULL,
    graduation_year INTEGER NOT NULL,
    enrollment_status VARCHAR(32) DEFAULT 'ENROLLED', -- 'ENROLLED', 'GRADUATED', 'SUSPENDED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. KYC Credentials Registry
CREATE TABLE IF NOT EXISTS kyc_credentials (
    credential_id VARCHAR(64) PRIMARY KEY REFERENCES credentials(credential_id),
    provider_id VARCHAR(64) NOT NULL REFERENCES issuers(issuer_id),
    kyc_tier INTEGER NOT NULL CHECK (kyc_tier >= 1 AND kyc_tier <= 3),
    jurisdiction VARCHAR(64) NOT NULL,
    id_type_hash TEXT NOT NULL,
    verification_standard VARCHAR(128) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Proof of Human Attestations
CREATE TABLE IF NOT EXISTS human_credentials (
    credential_id VARCHAR(64) PRIMARY KEY REFERENCES credentials(credential_id),
    attester_id VARCHAR(64) NOT NULL REFERENCES issuers(issuer_id),
    liveness_score NUMERIC(5,2) NOT NULL,
    sybil_resistance_level VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Credential Revocations Registry
CREATE TABLE IF NOT EXISTS credential_revocations (
    id SERIAL PRIMARY KEY,
    credential_id VARCHAR(64) NOT NULL REFERENCES credentials(credential_id),
    issuer_id VARCHAR(64) NOT NULL REFERENCES issuers(issuer_id),
    reason TEXT NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Verification Requests (Challenges & Nonces)
CREATE TABLE IF NOT EXISTS verification_requests (
    request_id VARCHAR(64) PRIMARY KEY,
    verifier_id VARCHAR(64) NOT NULL,
    verifier_name VARCHAR(255) NOT NULL,
    purpose TEXT NOT NULL,
    credential_type VARCHAR(64) DEFAULT 'AGE',
    min_age INTEGER CHECK (min_age >= 0 AND min_age <= 150),
    required_claims TEXT,
    nonce TEXT NOT NULL UNIQUE,        -- Unique cryptographic challenge
    status VARCHAR(32) DEFAULT 'PENDING', -- 'PENDING', 'CONSUMED', 'REJECTED', 'EXPIRED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 9. QR Verification Sessions
CREATE TABLE IF NOT EXISTS qr_verification_sessions (
    session_id VARCHAR(64) PRIMARY KEY,
    verifier_id VARCHAR(64) NOT NULL,
    verifier_name VARCHAR(255) NOT NULL,
    credential_type VARCHAR(64) NOT NULL, -- 'AGE', 'STUDENT', 'KYC', 'HUMAN', 'MULTI_CLAIM'
    required_claims TEXT NOT NULL,        -- JSON serialized claims
    nonce TEXT NOT NULL UNIQUE,
    status VARCHAR(32) DEFAULT 'PENDING', -- 'PENDING', 'SCANNED', 'VERIFIED', 'EXPIRED', 'REJECTED'
    result_payload TEXT,                  -- JSON serialized verification outcome
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 10. User Consent Records (Selective Disclosure History)
CREATE TABLE IF NOT EXISTS user_consent_records (
    id SERIAL PRIMARY KEY,
    session_or_request_id VARCHAR(64) NOT NULL,
    verifier_id VARCHAR(64) NOT NULL,
    credential_id VARCHAR(64) NOT NULL,
    approved_attributes TEXT NOT NULL,   -- JSON string of approved claims
    rejected_attributes TEXT,            -- JSON string of rejected claims
    consent_action VARCHAR(32) NOT NULL, -- 'APPROVED', 'REJECTED', 'PARTIAL_APPROVAL'
    consented_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Privacy-Preserving Verification Audit Logs
CREATE TABLE IF NOT EXISTS verification_logs (
    id SERIAL PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL,
    verifier_id VARCHAR(64) NOT NULL,
    verifier_name VARCHAR(255) NOT NULL,
    issuer_id VARCHAR(64),
    credential_type VARCHAR(64) DEFAULT 'AGE',
    requested_claim VARCHAR(128) NOT NULL, -- e.g., 'Age >= 18', 'Student Enrolled', 'KYC Tier >= 2'
    nullifier TEXT NOT NULL,             -- Unique nullifier from ZK circuit to prevent double-spending
    commitment TEXT NOT NULL,            -- Associated public commitment
    result VARCHAR(32) NOT NULL,         -- 'VALID', 'REJECTED'
    rejection_reason TEXT,
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indices for performance and anti-replay lookups
CREATE INDEX IF NOT EXISTS idx_requests_nonce ON verification_requests(nonce);
CREATE INDEX IF NOT EXISTS idx_qr_nonce ON qr_verification_sessions(nonce);
CREATE INDEX IF NOT EXISTS idx_logs_nullifier ON verification_logs(nullifier);
CREATE INDEX IF NOT EXISTS idx_credentials_commitment ON credentials(commitment);
CREATE INDEX IF NOT EXISTS idx_revocations_cred_id ON credential_revocations(credential_id);
CREATE INDEX IF NOT EXISTS idx_logs_verified_at ON verification_logs(verified_at);
CREATE INDEX IF NOT EXISTS idx_logs_claim_type ON verification_logs(requested_claim);
CREATE INDEX IF NOT EXISTS idx_logs_result ON verification_logs(result);
