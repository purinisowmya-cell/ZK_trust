import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiService } from '../services/api';

const WalletContext = createContext();

const LOCAL_STORAGE_KEY = 'zktrust_wallet_data_v2';
const LEGACY_STORAGE_KEY = 'zktrust_wallet_data';

export function WalletProvider({ children }) {
  const [currentRole, setCurrentRole] = useState('user'); // 'user' | 'issuer' | 'verifier' | 'student' | 'admin'
  const [credentials, setCredentials] = useState([]);
  const [activeCredentialId, setActiveCredentialId] = useState(null);
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  // Load saved credentials from localStorage on mount
  useEffect(() => {
    try {
      const savedV2 = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedV2) {
        const parsed = JSON.parse(savedV2);
        if (Array.isArray(parsed.credentials) && parsed.credentials.length > 0) {
          setCredentials(parsed.credentials);
          setActiveCredentialId(parsed.activeCredentialId || parsed.credentials[0].credential.credentialId);
          return;
        }
      }

      // Fallback: check legacy single credential
      const legacySaved = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacySaved) {
        const parsed = JSON.parse(legacySaved);
        if (parsed.credential && parsed.privateData) {
          const item = { credential: parsed.credential, privateData: parsed.privateData };
          setCredentials([item]);
          setActiveCredentialId(parsed.credential.credentialId);
        }
      }
    } catch (e) {
      console.warn('Could not restore wallet from storage:', e);
    }
  }, []);

  // Persist credentials whenever they change
  const persistState = (newCreds, newActiveId) => {
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({ credentials: newCreds, activeCredentialId: newActiveId })
      );
    } catch (e) {
      console.warn('Failed to persist wallet to storage:', e);
    }
  };

  const addCredential = (newCred, newPrivateData) => {
    setCredentials((prev) => {
      // Replace if existing ID or prepend new
      const filtered = prev.filter((c) => c.credential.credentialId !== newCred.credentialId);
      const updated = [{ credential: newCred, privateData: newPrivateData }, ...filtered];
      persistState(updated, newCred.credentialId);
      return updated;
    });
    setActiveCredentialId(newCred.credentialId);
  };

  // Backward compatibility: saveWalletCredential
  const saveWalletCredential = (newCred, newPrivateData) => {
    addCredential(newCred, newPrivateData);
  };

  const removeCredential = (credentialId) => {
    setCredentials((prev) => {
      const updated = prev.filter((c) => c.credential.credentialId !== credentialId);
      const nextActive = updated.length > 0 ? updated[0].credential.credentialId : null;
      persistState(updated, nextActive);
      setActiveCredentialId(nextActive);
      return updated;
    });
  };

  const updateCredentialStatus = (credentialId, status, revocationDetails = null) => {
    setCredentials((prev) => {
      const updated = prev.map((item) => {
        if (item.credential.credentialId === credentialId) {
          return {
            ...item,
            credential: {
              ...item.credential,
              status,
              revocationDetails,
            },
          };
        }
        return item;
      });
      persistState(updated, activeCredentialId);
      return updated;
    });
  };

  const syncWalletRevocations = async () => {
    if (credentials.length === 0) return;
    try {
      const ids = credentials.map((c) => c.credential.credentialId);
      const res = await apiService.batchCheckStatus(ids);
      if (Array.isArray(res.statuses)) {
        setCredentials((prev) => {
          let changed = false;
          const updated = prev.map((item) => {
            const check = res.statuses.find((s) => s.credentialId === item.credential.credentialId);
            if (check && (check.status !== item.credential.status)) {
              changed = true;
              return {
                ...item,
                credential: {
                  ...item.credential,
                  status: check.status,
                  revocationDetails: check.revocationDetails,
                },
              };
            }
            return item;
          });
          if (changed) {
            persistState(updated, activeCredentialId);
          }
          return updated;
        });
      }
    } catch (e) {
      console.warn('Could not auto-sync wallet revocations:', e);
    }
  };

  useEffect(() => {
    if (credentials.length > 0) {
      syncWalletRevocations();
    }
  }, [credentials.length]);

  const clearWallet = () => {
    setCredentials([]);
    setActiveCredentialId(null);
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (e) {}
  };

  // Active credential and private witness data getters
  const activeItem = credentials.find((c) => c.credential.credentialId === activeCredentialId) || credentials[0] || null;
  const credential = activeItem ? activeItem.credential : null;
  const privateData = activeItem ? activeItem.privateData : null;

  return (
    <WalletContext.Provider
      value={{
        currentRole,
        setCurrentRole,
        credentials,
        activeCredentialId,
        setActiveCredentialId,
        activeItem,
        credential,
        privateData,
        addCredential,
        saveWalletCredential,
        removeCredential,
        updateCredentialStatus,
        syncWalletRevocations,
        clearWallet,
        activeChallenge,
        setActiveChallenge,
        consentModalOpen,
        setConsentModalOpen,
        verificationResult,
        setVerificationResult,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
