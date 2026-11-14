import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { initDatabase, isUsingInMemoryDb } from './db/index.js';
import { initIssuerKeys } from './services/issuerKeyManager.js';
import {
  getIssuerProfile,
  issueCredential,
  getCredentialStatus,
} from './controllers/issuerController.js';
import {
  createVerificationChallenge,
  getVerificationChallenge,
  verifyProof,
  getAuditLogs,
} from './controllers/verifierController.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'ZK-Trust Backend Core',
    inMemoryDatabase: isUsingInMemoryDb(),
    timestamp: new Date().toISOString(),
  });
});

// Issuer API Routes
app.get('/api/issuer/public-key', getIssuerProfile);
app.post('/api/issuer/issue-credential', issueCredential);
app.get('/api/issuer/credentials/:id/status', getCredentialStatus);

// Verifier API Routes
app.post('/api/verifier/request-challenge', createVerificationChallenge);
app.get('/api/verifier/requests/:id', getVerificationChallenge);
app.post('/api/verifier/verify-proof', verifyProof);
app.get('/api/verifier/audit-logs', getAuditLogs);

// Initialize DB and Start Server
async function start() {
  try {
    console.log('--- Initializing ZK-Trust Backend ---');
    await initDatabase();
    await initIssuerKeys();

    app.listen(config.port, () => {
      console.log(`ZK-Trust API server listening on http://localhost:${config.port}`);
      console.log(`Database Mode: ${isUsingInMemoryDb() ? 'Embedded In-Memory (pg-mem)' : 'PostgreSQL'}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

export default app;
