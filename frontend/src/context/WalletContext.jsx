import React, { createContext, useContext, useState, useEffect } from 'react';

const WalletContext = createContext();

const LOCAL_STORAGE_KEY = 'zktrust_wallet_data';

export function WalletProvider({ children }) {
  const [currentRole, setCurrentRole] = useState('user'); // 'user' | 'issuer' | 'verifier'
  const [credential, setCredential] = useState(null);
  const [privateData, setPrivateData] = useState(null);
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  // Load saved demo credential from local storage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.credential && parsed.privateData) {
          setCredential(parsed.credential);
          setPrivateData(parsed.privateData);
        }
      }
    } catch (e) {
      console.warn('Could not restore wallet from storage:', e);
    }
  }, []);

  const saveWalletCredential = (newCred, newPrivateData) => {
    setCredential(newCred);
    setPrivateData(newPrivateData);
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({ credential: newCred, privateData: newPrivateData })
      );
    } catch (e) {
      console.warn('Failed to persist wallet to storage:', e);
    }
  };

  const clearWallet = () => {
    setCredential(null);
    setPrivateData(null);
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (e) {}
  };

  return (
    <WalletContext.Provider
      value={{
        currentRole,
        setCurrentRole,
        credential,
        privateData,
        saveWalletCredential,
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
