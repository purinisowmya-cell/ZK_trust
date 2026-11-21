import express from 'express';
import {
  revokeCredential,
  getRevocationStatus,
  batchCheckStatus,
  listRevocations,
} from '../controllers/revocationController.js';

const router = express.Router();

// Credential Revocation (Feature 6)
router.post('/revoke', revokeCredential);
router.post('/batch-status', batchCheckStatus);
router.get('/:id/revocation-status', getRevocationStatus);
router.get('/revocations', listRevocations);

export default router;
