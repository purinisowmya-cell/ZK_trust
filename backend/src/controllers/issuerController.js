import crypto from 'crypto';
import {
  poseidonHash,
  generateRandomSecret,
  signCredentialPayload,
  hashStringToField,
  generateEd25519KeyPair,
} from '../services/cryptoService.js';
import { getIssuerKeyPair, registerCustomIssuerKeys } from '../services/issuerKeyManager.js';
import { query } from '../db/index.js';
import { config } from '../config/index.js';
import { registerOnchainIssuer } from '../services/blockchainService.js';

/**
 * Helper to verify that an issuer is authorized and active before issuance.
 */
async function validateActiveIssuer(issuerId) {
  const result = await query(
    'SELECT issuer_id, name, issuer_type, public_key, is_active FROM issuers WHERE issuer_id = $1',
    [issuerId]
  );
  if (result.rows.length === 0) {
    throw new Error(`Unauthorized issuer '${issuerId}'. Authority is not registered in the trusted registry.`);
  }
  const issuer = result.rows[0];
  if (!issuer.is_active) {
    throw new Error(`Issuer authority '${issuer.name}' (${issuerId}) is currently deactivated or suspended.`);
  }
  return issuer;
}

/**
 * Retrieves an issuer's public profile and Ed25519 public key.
 */
export async function getIssuerProfile(req, res) {
  try {
    const issuerId = req.query.issuerId || config.issuer.id;
    const keys = getIssuerKeyPair(issuerId);
    const result = await query(
      `SELECT i.issuer_id, i.name, i.issuer_type, i.public_key, i.is_active, i.description, i.onchain_address,
              o.name as org_name, o.website as org_website
       FROM issuers i
       LEFT JOIN organizations o ON i.org_id = o.org_id
       WHERE i.issuer_id = $1`,
      [issuerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Issuer '${issuerId}' not registered.` });
    }

    const row = result.rows[0];
    return res.json({
      issuerId: row.issuer_id,
      name: row.name,
      orgName: row.org_name,
      issuerType: row.issuer_type,
      publicKey: keys.publicKey,
      isActive: row.is_active,
      description: row.description,
      onchainAddress: row.onchain_address,
    });
  } catch (err) {
    return res.status(500).json({ error: `Failed to fetch issuer: ${err.message}` });
  }
}

/**
 * Registers an accredited University or College as a trusted issuer (Feature 1 & 5).
 */
export async function registerUniversity(req, res) {
  try {
    const {
      universityName,
      officialDomain,
      country = 'US',
      contactEmail,
      accreditationBody = 'Higher Learning Commission (HLC)',
      departments = ['Computer Science', 'Engineering', 'Mathematics', 'Medicine', 'Business'],
    } = req.body;

    if (!universityName || !officialDomain) {
      return res.status(400).json({ error: 'universityName and officialDomain are required.' });
    }

    const slug = universityName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const orgId = `org:univ:${slug}`;
    const issuerId = `did:zktrust:issuer:${slug}`;

    // 1. Insert into organizations
    const existingOrg = await query('SELECT org_id FROM organizations WHERE org_id = $1', [orgId]);
    if (existingOrg.rows.length === 0) {
      await query(
        `INSERT INTO organizations (org_id, name, org_type, contact_email, website, is_verified)
         VALUES ($1, $2, 'UNIVERSITY', $3, $4, true)`,
        [orgId, universityName, contactEmail || `registrar@${officialDomain}`, `https://${officialDomain}`]
      );
    }

    // 2. Generate University Ed25519 Keypair
    const keyPair = generateEd25519KeyPair();
    registerCustomIssuerKeys(issuerId, keyPair);

    const onchainAddress = '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    // 3. Insert into issuers
    await query(
      `INSERT INTO issuers 
        (issuer_id, org_id, name, issuer_type, public_key, is_active, description, onchain_address)
       VALUES ($1, $2, $3, 'UNIVERSITY', $4, true, $5, $6)`,
      [
        issuerId,
        orgId,
        `${universityName} Academic Registrar`,
        keyPair.publicKey,
        `Accredited by ${accreditationBody}. Authorized to issue collegiate credentials.`,
        onchainAddress,
      ]
    );

    // 4. Sync on-chain
    await registerOnchainIssuer(issuerId, `${universityName} Academic Registrar`, 'UNIVERSITY', keyPair.publicKey, onchainAddress);

    console.log(`[Collegiate Registry] University registered: ${universityName} (${issuerId})`);

    return res.status(201).json({
      message: 'Collegiate issuer authority successfully accredited and registered.',
      university: {
        issuerId,
        orgId,
        universityName,
        officialDomain,
        accreditationBody,
        departments,
        publicKey: keyPair.publicKey,
        onchainAddress,
        isActive: true,
      },
    });
  } catch (err) {
    console.error('University registration error:', err);
    return res.status(500).json({ error: `University registration failed: ${err.message}` });
  }
}

/**
 * Returns list of accredited colleges and universities.
 */
export async function listColleges(req, res) {
  try {
    const result = await query(
      `SELECT i.issuer_id, i.name, i.public_key, i.is_active, i.description, i.onchain_address,
              o.name as org_name, o.website as official_domain, o.contact_email,
              COUNT(c.credential_id) as total_students_issued
       FROM issuers i
       JOIN organizations o ON i.org_id = o.org_id
       LEFT JOIN credentials c ON i.issuer_id = c.issuer_id AND c.credential_type = 'STUDENT'
       WHERE i.issuer_type = 'UNIVERSITY'
       GROUP BY i.issuer_id, i.name, i.public_key, i.is_active, i.description, i.onchain_address, o.name, o.website, o.contact_email
       ORDER BY o.name ASC`
    );
    return res.json({ colleges: result.rows });
  } catch (err) {
    return res.status(500).json({ error: `Failed to list colleges: ${err.message}` });
  }
}

/**
 * Issues an Age identity credential.
 */
export async function issueCredential(req, res) {
  try {
    let { age, dateOfBirth, fullName, secret, issuerId } = req.body;
    const targetIssuerId = issuerId || config.issuer.id;

    // Verify authorized issuer
    await validateActiveIssuer(targetIssuerId);

    if (age === undefined || age === null || isNaN(Number(age))) {
      if (dateOfBirth) {
        const dob = new Date(dateOfBirth);
        if (isNaN(dob.getTime())) {
          return res.status(400).json({ error: 'Invalid date of birth provided.' });
        }
        const diffMs = Date.now() - dob.getTime();
        const ageDt = new Date(diffMs);
        age = Math.abs(ageDt.getUTCFullYear() - 1970);
      } else {
        return res.status(400).json({ error: 'Must provide either age or dateOfBirth.' });
      }
    } else {
      age = parseInt(age, 10);
    }

    if (age < 0 || age > 150) {
      return res.status(400).json({ error: 'Age must be between 0 and 150.' });
    }

    const credentialSecret = secret ? secret.toString() : generateRandomSecret();
    const commitment = await poseidonHash([age, credentialSecret]);

    const credentialId = 'cred_age_' + crypto.randomUUID();
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const canonicalPayload = {
      credentialId,
      issuerId: targetIssuerId,
      commitment,
      issuedAt,
      expiresAt,
    };

    const keys = getIssuerKeyPair(targetIssuerId);
    const issuerSignature = signCredentialPayload(canonicalPayload, keys.privateKey);

    await query(
      `INSERT INTO credentials 
        (credential_id, issuer_id, credential_type, commitment, issued_at, expires_at, status, issuer_signature)
       VALUES ($1, $2, 'AGE', $3, $4, $5, 'ACTIVE', $6)`,
      [credentialId, targetIssuerId, commitment, issuedAt, expiresAt, issuerSignature]
    );

    return res.status(201).json({
      message: 'Age credential successfully issued.',
      credential: {
        credentialId,
        issuerId: targetIssuerId,
        credentialType: 'AGE',
        commitment,
        issuedAt,
        expiresAt,
        status: 'ACTIVE',
        issuerSignature,
      },
      privateData: {
        age,
        secret: credentialSecret,
        fullName: fullName || 'Demo Citizen',
        dateOfBirth: dateOfBirth || null,
      },
    });
  } catch (err) {
    console.error('Age credential issuance error:', err);
    return res.status(err.message.includes('Unauthorized') ? 403 : 500).json({
      error: `Credential issuance failed: ${err.message}`,
    });
  }
}

/**
 * Issues a verified Student Credential (Feature 1).
 */
export async function issueStudentCredential(req, res) {
  try {
    const {
      studentId = 'STU-' + Math.floor(100000 + Math.random() * 900000),
      fullName = 'Alex Morgan',
      collegeName = 'Massachusetts Institute of Technology',
      department = 'Computer Science and Artificial Intelligence',
      course = 'B.S. in Computer Science',
      graduationYear = 2027,
      enrollmentStatus = 'ENROLLED',
      issuerId = 'did:zktrust:issuer:mit-edu',
      secret,
    } = req.body;

    // Verify authorized active university issuer
    const issuer = await validateActiveIssuer(issuerId);
    if (issuer.issuer_type !== 'UNIVERSITY') {
      return res.status(400).json({ error: `Issuer '${issuer.name}' is not accredited as a collegiate authority.` });
    }

    const validatedGradYear = parseInt(graduationYear, 10);
    if (isNaN(validatedGradYear) || validatedGradYear < 2000 || validatedGradYear > 2040) {
      return res.status(400).json({ error: 'Valid graduation year between 2000 and 2040 is required.' });
    }

    const credentialSecret = secret ? secret.toString() : generateRandomSecret();

    // Compute composite student attribute hash: sha256(studentId + department + course + gradYear)
    const compositeString = `${studentId}|${collegeName}|${department}|${course}|${validatedGradYear}|${enrollmentStatus}`;
    const studentAttrHash = hashStringToField(compositeString);

    // Compute cryptographic Poseidon commitment
    const commitment = await poseidonHash([studentAttrHash, credentialSecret]);

    const credentialId = 'cred_stu_' + crypto.randomUUID();
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const canonicalPayload = {
      credentialId,
      issuerId,
      commitment,
      issuedAt,
      expiresAt,
    };

    const keys = getIssuerKeyPair(issuerId);
    const issuerSignature = signCredentialPayload(canonicalPayload, keys.privateKey);

    // Store in credentials table
    await query(
      `INSERT INTO credentials 
        (credential_id, issuer_id, credential_type, commitment, issued_at, expires_at, status, issuer_signature)
       VALUES ($1, $2, 'STUDENT', $3, $4, $5, 'ACTIVE', $6)`,
      [credentialId, issuerId, commitment, issuedAt, expiresAt, issuerSignature]
    );

    // Store student specific details
    const studentIdHash = hashStringToField(studentId);
    await query(
      `INSERT INTO student_credentials
        (credential_id, institution_id, student_id_hash, department, course, graduation_year, enrollment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [credentialId, issuerId, studentIdHash, department, course, validatedGradYear, enrollmentStatus]
    );

    console.log(`[Student Issuer] Credential issued for ${studentId} at ${collegeName}`);

    return res.status(201).json({
      message: 'Student credential successfully issued.',
      credential: {
        credentialId,
        issuerId,
        credentialType: 'STUDENT',
        collegeName,
        department,
        course,
        graduationYear: validatedGradYear,
        enrollmentStatus,
        commitment,
        issuedAt,
        expiresAt,
        status: 'ACTIVE',
        issuerSignature,
      },
      privateData: {
        studentId,
        fullName,
        collegeName,
        department,
        course,
        graduationYear: validatedGradYear,
        enrollmentStatus,
        studentAttrHash,
        secret: credentialSecret,
      },
    });
  } catch (err) {
    console.error('Student credential error:', err);
    return res.status(err.message.includes('Unauthorized') ? 403 : 500).json({
      error: `Student credential issuance failed: ${err.message}`,
    });
  }
}

/**
 * Issues a Privacy-Preserving KYC Credential (Feature 3).
 */
export async function issueKycCredential(req, res) {
  try {
    const {
      fullName = 'Demo Citizen',
      kycTier = 2,
      jurisdiction = 'US',
      idType = 'PASSPORT',
      verificationStandard = 'ISO-30107-3',
      issuerId = 'did:zktrust:issuer:trust-kyc',
      secret,
    } = req.body;

    await validateActiveIssuer(issuerId);

    const validatedTier = Math.min(Math.max(parseInt(kycTier, 10) || 1, 1), 3);
    const credentialSecret = secret ? secret.toString() : generateRandomSecret();

    const commitment = await poseidonHash([validatedTier, credentialSecret]);

    const credentialId = 'cred_kyc_' + crypto.randomUUID();
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const canonicalPayload = {
      credentialId,
      issuerId,
      commitment,
      issuedAt,
      expiresAt,
    };

    const keys = getIssuerKeyPair(issuerId);
    const issuerSignature = signCredentialPayload(canonicalPayload, keys.privateKey);

    await query(
      `INSERT INTO credentials 
        (credential_id, issuer_id, credential_type, commitment, issued_at, expires_at, status, issuer_signature)
       VALUES ($1, $2, 'KYC', $3, $4, $5, 'ACTIVE', $6)`,
      [credentialId, issuerId, commitment, issuedAt, expiresAt, issuerSignature]
    );

    const idTypeHash = hashStringToField(idType + ':' + crypto.randomUUID());
    await query(
      `INSERT INTO kyc_credentials
        (credential_id, provider_id, kyc_tier, jurisdiction, id_type_hash, verification_standard)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [credentialId, issuerId, validatedTier, jurisdiction, idTypeHash, verificationStandard]
    );

    return res.status(201).json({
      message: 'Privacy-preserving KYC credential issued.',
      credential: {
        credentialId,
        issuerId,
        credentialType: 'KYC',
        kycTier: validatedTier,
        jurisdiction,
        verificationStandard,
        commitment,
        issuedAt,
        expiresAt,
        status: 'ACTIVE',
        issuerSignature,
      },
      privateData: {
        fullName,
        kycTier: validatedTier,
        jurisdiction,
        idType,
        secret: credentialSecret,
      },
    });
  } catch (err) {
    console.error('KYC issuance error:', err);
    return res.status(err.message.includes('Unauthorized') ? 403 : 500).json({
      error: `KYC issuance failed: ${err.message}`,
    });
  }
}

/**
 * Issues a Proof of Human Sybil-Resistant Credential (Feature 8).
 */
export async function issueHumanCredential(req, res) {
  try {
    const {
      fullName = 'Human User',
      livenessScore = 98.7,
      sybilResistanceLevel = 'HIGH',
      issuerId = 'did:zktrust:issuer:human-id',
      secret,
    } = req.body;

    await validateActiveIssuer(issuerId);

    const validatedScore = parseFloat(livenessScore) || 95.0;
    const credentialSecret = secret ? secret.toString() : generateRandomSecret();

    const scaledScore = Math.floor(validatedScore * 100);
    const commitment = await poseidonHash([scaledScore, credentialSecret]);

    const credentialId = 'cred_hum_' + crypto.randomUUID();
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

    const canonicalPayload = {
      credentialId,
      issuerId,
      commitment,
      issuedAt,
      expiresAt,
    };

    const keys = getIssuerKeyPair(issuerId);
    const issuerSignature = signCredentialPayload(canonicalPayload, keys.privateKey);

    await query(
      `INSERT INTO credentials 
        (credential_id, issuer_id, credential_type, commitment, issued_at, expires_at, status, issuer_signature)
       VALUES ($1, $2, 'HUMAN', $3, $4, $5, 'ACTIVE', $6)`,
      [credentialId, issuerId, commitment, issuedAt, expiresAt, issuerSignature]
    );

    await query(
      `INSERT INTO human_credentials
        (credential_id, attester_id, liveness_score, sybil_resistance_level)
       VALUES ($1, $2, $3, $4)`,
      [credentialId, issuerId, validatedScore, sybilResistanceLevel]
    );

    return res.status(201).json({
      message: 'Proof of Human attestation credential issued.',
      credential: {
        credentialId,
        issuerId,
        credentialType: 'HUMAN',
        livenessScore: validatedScore,
        sybilResistanceLevel,
        commitment,
        issuedAt,
        expiresAt,
        status: 'ACTIVE',
        issuerSignature,
      },
      privateData: {
        fullName,
        livenessScore: validatedScore,
        sybilResistanceLevel,
        secret: credentialSecret,
      },
    });
  } catch (err) {
    console.error('Human attestation error:', err);
    return res.status(err.message.includes('Unauthorized') ? 403 : 500).json({
      error: `Human credential issuance failed: ${err.message}`,
    });
  }
}

/**
 * Issuer Management Dashboard Telemetry (Feature 5).
 */
export async function getIssuerDashboard(req, res) {
  try {
    const { issuerId } = req.params;

    const issuerResult = await query(
      `SELECT i.issuer_id, i.name, i.issuer_type, i.public_key, i.is_active, i.description, i.onchain_address,
              o.name as org_name, o.website as org_website, o.contact_email
       FROM issuers i
       LEFT JOIN organizations o ON i.org_id = o.org_id
       WHERE i.issuer_id = $1`,
      [issuerId]
    );

    if (issuerResult.rows.length === 0) {
      return res.status(404).json({ error: `Issuer '${issuerId}' not found.` });
    }

    const issuer = issuerResult.rows[0];

    // Count statistics
    const statsResult = await query(
      `SELECT 
        COUNT(*) as total_issued,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_count,
        COUNT(CASE WHEN status = 'REVOKED' THEN 1 END) as revoked_count,
        COUNT(CASE WHEN credential_type = 'STUDENT' THEN 1 END) as student_count,
        COUNT(CASE WHEN credential_type = 'AGE' THEN 1 END) as age_count,
        COUNT(CASE WHEN credential_type = 'KYC' THEN 1 END) as kyc_count,
        COUNT(CASE WHEN credential_type = 'HUMAN' THEN 1 END) as human_count
       FROM credentials 
       WHERE issuer_id = $1`,
      [issuerId]
    );

    const recentResult = await query(
      `SELECT credential_id, credential_type, status, issued_at, expires_at 
       FROM credentials 
       WHERE issuer_id = $1 
       ORDER BY issued_at DESC LIMIT 10`,
      [issuerId]
    );

    return res.json({
      issuer,
      stats: statsResult.rows[0],
      recentCredentials: recentResult.rows,
    });
  } catch (err) {
    return res.status(500).json({ error: `Failed to fetch issuer dashboard: ${err.message}` });
  }
}

/**
 * Rotates an issuer's Ed25519 cryptographic keypair (Feature 5).
 */
export async function rotateIssuerKey(req, res) {
  try {
    const { issuerId } = req.body;
    if (!issuerId) {
      return res.status(400).json({ error: 'issuerId is required for key rotation.' });
    }

    await validateActiveIssuer(issuerId);

    const newKeyPair = generateEd25519KeyPair();
    registerCustomIssuerKeys(issuerId, newKeyPair);

    await query(
      'UPDATE issuers SET public_key = $1 WHERE issuer_id = $2',
      [newKeyPair.publicKey, issuerId]
    );

    const issuerResult = await query('SELECT name, issuer_type, onchain_address FROM issuers WHERE issuer_id = $1', [issuerId]);
    const { name, issuer_type, onchain_address } = issuerResult.rows[0];
    await registerOnchainIssuer(issuerId, name, issuer_type, newKeyPair.publicKey, onchain_address);

    console.log(`[Key Rotation] Issuer '${issuerId}' rotated signing keypair.`);

    return res.json({
      message: 'Issuer keypair rotated successfully and synchronized with on-chain registry.',
      issuerId,
      newPublicKey: newKeyPair.publicKey,
      rotatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: `Key rotation failed: ${err.message}` });
  }
}

/**
 * Checks the status of an existing credential.
 */
export async function getCredentialStatus(req, res) {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT c.credential_id, c.issuer_id, c.credential_type, c.status, c.issued_at, c.expires_at,
              r.reason as revocation_reason, r.revoked_at
       FROM credentials c
       LEFT JOIN credential_revocations r ON c.credential_id = r.credential_id
       WHERE c.credential_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Credential not found.' });
    }

    const cred = result.rows[0];
    const isRevoked = cred.status === 'REVOKED' || !!cred.revocation_reason;
    const isExpired = new Date(cred.expires_at) < new Date();
    const effectiveStatus = isRevoked ? 'REVOKED' : isExpired ? 'EXPIRED' : cred.status;

    return res.json({
      credentialId: cred.credential_id,
      issuerId: cred.issuer_id,
      credentialType: cred.credential_type,
      status: effectiveStatus,
      isRevoked,
      isExpired,
      revocationReason: cred.revocation_reason || null,
      issuedAt: cred.issued_at,
      expiresAt: cred.expires_at,
    });
  } catch (err) {
    return res.status(500).json({ error: `Failed to check credential: ${err.message}` });
  }
}

/**
 * Lists all issued credentials for an issuer.
 */
export async function listCredentials(req, res) {
  try {
    const { issuerId, credentialType } = req.query;
    let queryText = `
      SELECT c.credential_id, c.issuer_id, c.credential_type, c.status, c.issued_at, c.expires_at,
             i.name as issuer_name,
             r.reason as revocation_reason, r.revoked_at
      FROM credentials c
      LEFT JOIN issuers i ON c.issuer_id = i.issuer_id
      LEFT JOIN credential_revocations r ON c.credential_id = r.credential_id
      WHERE 1=1
    `;
    const params = [];

    if (issuerId) {
      params.push(issuerId);
      queryText += ` AND c.issuer_id = $${params.length}`;
    }

    if (credentialType) {
      params.push(credentialType);
      queryText += ` AND c.credential_type = $${params.length}`;
    }

    queryText += ` ORDER BY c.issued_at DESC LIMIT 100`;

    const result = await query(queryText, params);
    return res.json({ credentials: result.rows });
  } catch (err) {
    return res.status(500).json({ error: `Failed to list credentials: ${err.message}` });
  }
}
