import express from 'express';
import {
  getIssuerProfile,
  issueCredential,
  issueStudentCredential,
  issueKycCredential,
  issueHumanCredential,
  getCredentialStatus,
  listCredentials,
} from '../controllers/issuerController.js';

const router = express.Router();

// Public key & profile
router.get('/public-key', getIssuerProfile);

// Credential Issuance Endpoints
router.post('/issue-credential', issueCredential); // Age Credential
router.post('/issue-student-credential', issueStudentCredential); // Feature 1: Student Credential
router.post('/issue-kyc-credential', issueKycCredential); // Feature 3: KYC Credential
router.post('/issue-human-credential', issueHumanCredential); // Feature 8: Proof of Human

// Credential Status & Listing
router.get('/credentials/:id/status', getCredentialStatus);
router.get('/credentials', listCredentials);

export default router;
