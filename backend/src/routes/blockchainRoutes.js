import express from 'express';
import {
  getBlockchainStatus,
  getAllOnchainIssuers,
  getOnchainIssuer,
  registerOnchainIssuer,
  syncIssuersWithBlockchain,
} from '../services/blockchainService.js';

const router = express.Router();

router.get('/status', async (req, res) => {
  try {
    const status = await getBlockchainStatus();
    return res.json(status);
  } catch (err) {
    return res.status(500).json({ error: `Failed to fetch blockchain status: ${err.message}` });
  }
});

router.get('/issuers', async (req, res) => {
  try {
    const issuers = await getAllOnchainIssuers();
    return res.json({ issuers });
  } catch (err) {
    return res.status(500).json({ error: `Failed to fetch on-chain issuers: ${err.message}` });
  }
});

router.get('/issuers/:id', async (req, res) => {
  try {
    const issuer = await getOnchainIssuer(req.params.id);
    if (!issuer) {
      return res.status(404).json({ error: `On-chain issuer '${req.params.id}' not found.` });
    }
    return res.json(issuer);
  } catch (err) {
    return res.status(500).json({ error: `Failed to fetch issuer: ${err.message}` });
  }
});

router.post('/sync', async (req, res) => {
  try {
    await syncIssuersWithBlockchain();
    return res.json({ message: 'Issuers synchronized with on-chain registry successfully.' });
  } catch (err) {
    return res.status(500).json({ error: `Sync failed: ${err.message}` });
  }
});

export default router;
