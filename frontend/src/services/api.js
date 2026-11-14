import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiService = {
  // Health
  checkHealth: async () => {
    const res = await api.get('/health');
    return res.data;
  },

  // Issuer APIs
  getIssuerProfile: async () => {
    const res = await api.get('/issuer/public-key');
    return res.data;
  },

  issueCredential: async (payload) => {
    // payload: { fullName, age, dateOfBirth, secret }
    const res = await api.post('/issuer/issue-credential', payload);
    return res.data;
  },

  getCredentialStatus: async (credentialId) => {
    const res = await api.get(`/issuer/credentials/${credentialId}/status`);
    return res.data;
  },

  // Verifier APIs
  createChallenge: async (payload) => {
    // payload: { verifierId, verifierName, purpose, minAge }
    const res = await api.post('/verifier/request-challenge', payload);
    return res.data;
  },

  getChallenge: async (requestId) => {
    const res = await api.get(`/verifier/requests/${requestId}`);
    return res.data;
  },

  verifyProof: async (payload) => {
    // payload: { requestId, proof, publicSignals, credentialPayload, issuerSignature }
    const res = await api.post('/verifier/verify-proof', payload);
    return res.data;
  },

  getAuditLogs: async () => {
    const res = await api.get('/verifier/audit-logs');
    return res.data;
  },
};

export default apiService;
