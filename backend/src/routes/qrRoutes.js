import express from 'express';
import {
  createQrSession,
  getQrSession,
  scanQrSession,
  submitQrProof,
  rejectQrSession,
  getConsentRecords,
} from '../controllers/qrController.js';

const router = express.Router();

// QR-Based Identity Verification (Feature 4 & 9)
router.post('/qr-session', createQrSession);
router.get('/qr-session/:id', getQrSession);
router.patch('/qr-session/:id/scan', scanQrSession);
router.post('/qr-session/:id/submit', submitQrProof);
router.post('/qr-session/:id/reject', rejectQrSession);
router.get('/consent-records', getConsentRecords);

export default router;
