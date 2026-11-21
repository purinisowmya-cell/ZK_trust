import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { initDatabase, isUsingInMemoryDb } from './db/index.js';
import { initIssuerKeys } from './services/issuerKeyManager.js';

// Modular Route Handlers
import issuerRoutes from './routes/issuerRoutes.js';
import verifierRoutes from './routes/verifierRoutes.js';
import credentialRoutes from './routes/credentialRoutes.js';
import qrRoutes from './routes/qrRoutes.js';
import organizationRoutes from './routes/organizationRoutes.js';
import blockchainRoutes from './routes/blockchainRoutes.js';

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

// Mount Modular Routes
app.use('/api/issuer', issuerRoutes);
app.use('/api/verifier', verifierRoutes);
app.use('/api/verifier', qrRoutes); // Allows /api/verifier/qr-session
app.use('/api/credentials', credentialRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api', organizationRoutes);

// Direct backward-compatibility aliases
app.use('/api', issuerRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled request error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

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
