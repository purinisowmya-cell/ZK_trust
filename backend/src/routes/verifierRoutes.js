import express from 'express';
import {
  createVerificationChallenge,
  getVerificationChallenge,
  verifyProof,
  verifySelectiveDisclosure,
  getAuditLogs,
} from '../controllers/verifierController.js';

const router = express.Router();

// Challenge management
router.post('/request-challenge', createVerificationChallenge);
router.get('/requests/:id', getVerificationChallenge);

// Proof verification
router.post('/verify-proof', verifyProof);
router.post('/verify-selective-disclosure', verifySelectiveDisclosure);

// Privacy-preserving audit logs
router.get('/audit-logs', getAuditLogs);

export default router;
