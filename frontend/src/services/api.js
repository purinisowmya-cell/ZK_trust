import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

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

  // Organizations & Issuers
  getOrganizations: async () => {
    const res = await api.get('/organizations');
    return res.data;
  },

  getIssuers: async () => {
    const res = await api.get('/issuers');
    return res.data;
  },

  getIssuerById: async (id) => {
    const res = await api.get(`/issuers/${id}`);
    return res.data;
  },

  registerIssuer: async (payload) => {
    const res = await api.post('/issuers/register', payload);
    return res.data;
  },

  getIssuerProfile: async (issuerId = null) => {
    const url = issuerId ? `/issuer/public-key?issuerId=${encodeURIComponent(issuerId)}` : '/issuer/public-key';
    const res = await api.get(url);
    return res.data;
  },

  // Credential Issuance
  issueCredential: async (payload) => {
    // payload: { fullName, age, dateOfBirth, secret, issuerId }
    const res = await api.post('/issuer/issue-credential', payload);
    return res.data;
  },

  issueStudentCredential: async (payload) => {
    // payload: { studentId, fullName, collegeName, department, course, graduationYear, enrollmentStatus, issuerId, secret }
    const res = await api.post('/issuer/issue-student-credential', payload);
    return res.data;
  },

  issueKycCredential: async (payload) => {
    // payload: { fullName, kycTier, jurisdiction, idType, issuerId, secret }
    const res = await api.post('/issuer/issue-kyc-credential', payload);
    return res.data;
  },

  issueHumanCredential: async (payload) => {
    // payload: { fullName, livenessScore, sybilResistanceLevel, issuerId, secret }
    const res = await api.post('/issuer/issue-human-credential', payload);
    return res.data;
  },

  getCredentialStatus: async (credentialId) => {
    const res = await api.get(`/issuer/credentials/${credentialId}/status`);
    return res.data;
  },

  listIssuerCredentials: async (issuerId = null, credentialType = null) => {
    const params = new URLSearchParams();
    if (issuerId) params.append('issuerId', issuerId);
    if (credentialType) params.append('credentialType', credentialType);
    const res = await api.get(`/issuer/credentials?${params.toString()}`);
    return res.data;
  },

  // Credential Revocation (Feature 6)
  revokeCredential: async (payload) => {
    // payload: { credentialId, issuerId, reason }
    const res = await api.post('/credentials/revoke', payload);
    return res.data;
  },

  getRevocationStatus: async (credentialId) => {
    const res = await api.get(`/credentials/${credentialId}/revocation-status`);
    return res.data;
  },

  listRevocations: async () => {
    const res = await api.get('/credentials/revocations');
    return res.data;
  },

  // Verifier APIs
  createChallenge: async (payload) => {
    // payload: { verifierId, verifierName, purpose, minAge, credentialType, requiredClaims }
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

  verifySelectiveDisclosure: async (payload) => {
    // payload: { credentialType, credentialPayload, issuerSignature, disclosedClaims, verifierId, verifierName }
    const res = await api.post('/verifier/verify-selective-disclosure', payload);
    return res.data;
  },

  // QR-Based Identity Verification (Feature 4)
  createQrSession: async (payload) => {
    // payload: { verifierId, verifierName, credentialType, requiredClaims, expirySeconds }
    const res = await api.post('/verifier/qr-session', payload);
    return res.data;
  },

  getQrSession: async (sessionId) => {
    const res = await api.get(`/verifier/qr-session/${sessionId}`);
    return res.data;
  },

  scanQrSession: async (sessionId) => {
    const res = await api.patch(`/verifier/qr-session/${sessionId}/scan`);
    return res.data;
  },

  submitQrProof: async (sessionId, payload) => {
    // payload: { proof, publicSignals, credentialPayload, issuerSignature, disclosedClaims }
    const res = await api.post(`/verifier/qr-session/${sessionId}/submit`, payload);
    return res.data;
  },

  // Privacy-Preserving Audit Logs (Feature 10)
  getAuditLogs: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await api.get(`/verifier/audit-logs${query ? '?' + query : ''}`);
    return res.data;
  },

  // Blockchain Issuer Registry (Feature 7)
  getBlockchainStatus: async () => {
    const res = await api.get('/blockchain/status');
    return res.data;
  },

  getAllOnchainIssuers: async () => {
    const res = await api.get('/blockchain/issuers');
    return res.data;
  },

  getOnchainIssuer: async (id) => {
    const res = await api.get(`/blockchain/issuers/${id}`);
    return res.data;
  },

  syncBlockchain: async () => {
    const res = await api.post('/blockchain/sync');
    return res.data;
  },
};

export default apiService;
