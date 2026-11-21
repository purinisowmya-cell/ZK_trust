import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: process.env.PORT || 5001,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  issuer: {
    id: process.env.ISSUER_ID || 'did:zktrust:issuer:gov-demo-1',
    name: process.env.ISSUER_NAME || 'Official Identity & Licensing Authority (Demo)',
    // Pre-configured Ed25519 demo private/public key if provided, or generated at runtime
    privateKeyPem: process.env.ISSUER_PRIVATE_KEY || '',
    publicKeyPem: process.env.ISSUER_PUBLIC_KEY || '',
  },
  verification: {
    challengeExpirySeconds: parseInt(process.env.CHALLENGE_EXPIRY_SECONDS || '300', 10), // 5 minutes
    circuitVerificationKeyPath: path.resolve(
      __dirname,
      '../../../circuits/build/verification_key.json'
    ),
  },
};
