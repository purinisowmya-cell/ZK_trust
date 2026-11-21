import express from 'express';
import {
  createQrSession,
  getQrSession,
  scanQrSession,
  submitQrProof,
} from '../controllers/qrController.js';

const router = express.Router();

// QR-Based Identity Verification (Feature 4)
router.post('/qr-session', createQrSession);
router.get('/qr-session/:id', getQrSession);
router.patch('/qr-session/:id/scan', scanQrSession);
router.post('/qr-session/:id/submit', submitQrProof);

export default router;
