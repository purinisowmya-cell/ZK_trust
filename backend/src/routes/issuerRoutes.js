import express from 'express';
import {
  getIssuerProfile,
  issueCredential,
  issueStudentCredential,
  issueKycCredential,
  issueHumanCredential,
  getCredentialStatus,
  listCredentials,
  registerUniversity,
  listColleges,
  getIssuerDashboard,
  rotateIssuerKey,
} from '../controllers/issuerController.js';

const router = express.Router();

// Public key & profile
router.get('/public-key', getIssuerProfile);

// Collegiate Registration & Directory (Feature 1 & 5)
router.post('/university/register', registerUniversity);
router.get('/colleges', listColleges);

// Issuer Management Dashboard & Key Rotation (Feature 5)
router.get('/dashboard/:issuerId', getIssuerDashboard);
router.post('/rotate-key', rotateIssuerKey);

// Credential Issuance Endpoints
router.post('/issue-credential', issueCredential); // Age Credential
router.post('/issue-student-credential', issueStudentCredential); // Feature 1: Student Credential
router.post('/issue-kyc-credential', issueKycCredential); // Feature 3: KYC Credential
router.post('/issue-human-credential', issueHumanCredential); // Feature 8: Proof of Human

// Credential Status & Listing
router.get('/credentials/:id/status', getCredentialStatus);
router.get('/credentials', listCredentials);

export default router;
