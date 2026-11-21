import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Smartphone,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Copy,
  Scan,
  Clock,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { apiService } from '../services/api';
import QrCodeSvg from '../components/QrCodeSvg';

export default function QrVerification() {
  const { credentials } = useWallet();
  const [activeTab, setActiveTab] = useState('verifier'); // 'verifier' | 'wallet'

  // Verifier State
  const [credentialType, setCredentialType] = useState('AGE');
  const [minAge, setMinAge] = useState(21);
  const [qrSession, setQrSession] = useState(null);
  const [pollingStatus, setPollingStatus] = useState(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [verifierError, setVerifierError] = useState(null);

  // Wallet Scanner State
  const [scannedPayload, setScannedPayload] = useState('');
  const [parsedSession, setParsedSession] = useState(null);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [walletError, setWalletError] = useState(null);

  // Create QR Session on mount or when type changes
  const handleCreateQrSession = async () => {
    try {
      setCreatingSession(true);
      setVerifierError(null);
      setPollingStatus(null);

      const requiredClaims =
        credentialType === 'AGE'
          ? { minAge }
          : credentialType === 'STUDENT'
          ? { enrollmentStatus: 'ENROLLED' }
          : credentialType === 'KYC'
          ? { kycTier: 2 }
          : { livenessScore: 95.0 };

      const res = await apiService.createQrSession({
        verifierId: 'verifier:terminal-relying-party',
        verifierName: 'Secure Portal Terminal',
        credentialType,
        requiredClaims,
        expirySeconds: 300,
      });

      setQrSession(res);
      setPollingStatus({ status: 'PENDING' });
    } catch (err) {
      setVerifierError(err.response?.data?.error || err.message || 'Failed to create QR challenge.');
    } finally {
      setCreatingSession(false);
    }
  };

  useEffect(() => {
    handleCreateQrSession();
  }, [credentialType, minAge]);

  // Real-time polling for Verifier display
  useEffect(() => {
    if (!qrSession?.sessionId || pollingStatus?.status === 'VERIFIED') return;

    const interval = setInterval(async () => {
      try {
        const check = await apiService.getQrSession(qrSession.sessionId);
        setPollingStatus(check);
      } catch (e) {
        console.warn('QR polling error:', e);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [qrSession, pollingStatus?.status]);

  // Quick simulate scan from wallet
  const handleSimulateScan = () => {
    if (!qrSession) return;
    setScannedPayload(qrSession.qrPayload);
    try {
      const parsed = JSON.parse(qrSession.qrPayload);
      setParsedSession(parsed);
      setActiveTab('wallet');
      apiService.scanQrSession(qrSession.sessionId).catch(() => {});
    } catch (e) {}
  };

  // Wallet submits proof to session
  const handleSubmitProof = async () => {
    if (!parsedSession) return;

    // Pick matching credential from wallet
    const matchingItem = credentials.find(
      (c) =>
        (parsedSession.credentialType === 'AGE' && (c.credential.credentialType === 'AGE' || !c.credential.credentialType)) ||
        c.credential.credentialType === parsedSession.credentialType
    );

    if (!matchingItem) {
      setWalletError(`No ${parsedSession.credentialType} credential found in your wallet to fulfill this challenge.`);
      return;
    }

    if (matchingItem.credential.status === 'REVOKED') {
      setWalletError('Cannot submit: This credential has been revoked by the issuer.');
      return;
    }

    try {
      setSubmittingProof(true);
      setWalletError(null);

      const payload = {
        credentialPayload: {
          credentialId: matchingItem.credential.credentialId,
          issuerId: matchingItem.credential.issuerId,
          commitment: matchingItem.credential.commitment,
          issuedAt: matchingItem.credential.issuedAt,
          expiresAt: matchingItem.credential.expiresAt,
        },
        issuerSignature: matchingItem.credential.issuerSignature,
        disclosedClaims: parsedSession.requiredClaims,
      };

      const res = await apiService.submitQrProof(parsedSession.sessionId, payload);
      setSubmitResult(res);
    } catch (err) {
      setWalletError(err.response?.data?.error || err.message || 'Failed to submit proof to session.');
    } finally {
      setSubmittingProof(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950/40 via-cyan-950/30 to-slate-900 border border-blue-500/20 p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
              <QrCode className="w-3.5 h-3.5" />
              <span>Feature 4 • Contactless QR Handshake</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              QR-Based Identity Verification
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl">
              Instant relying-party verification challenges. Verifiers display a cryptographic QR code; users scan with
              their wallet, approve consent, and submit privacy-preserving zero-knowledge proofs.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-950 p-1.5 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => setActiveTab('verifier')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'verifier'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>Verifier Terminal</span>
            </button>
            <button
              onClick={() => setActiveTab('wallet')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'wallet'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Wallet Scanner</span>
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'verifier' ? (
        /* ================= TAB 1: VERIFIER DISPLAY ================= */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-5">
              <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                <span>Configure Challenge</span>
              </h2>

              <div className="space-y-3">
                <label className="text-xs text-slate-400 font-semibold uppercase block">
                  Required Credential Type:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['AGE', 'STUDENT', 'KYC', 'HUMAN'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setCredentialType(t)}
                      className={`p-2.5 rounded-xl text-xs font-bold border transition-all ${
                        credentialType === t
                          ? 'bg-blue-500/20 border-blue-500/60 text-blue-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {credentialType === 'AGE' && (
                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <label className="text-xs text-slate-400">Minimum Age: {minAge}+</label>
                    <input
                      type="range"
                      min="18"
                      max="65"
                      value={minAge}
                      onChange={(e) => setMinAge(parseInt(e.target.value, 10))}
                      className="w-full accent-blue-400"
                    />
                  </div>
                )}
              </div>

              <button
                onClick={handleCreateQrSession}
                disabled={creatingSession}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${creatingSession ? 'animate-spin' : ''}`} />
                <span>Regenerate Fresh Nonce</span>
              </button>

              <button
                onClick={handleSimulateScan}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <Smartphone className="w-4 h-4" />
                <span>Simulate In-Wallet Scan &rarr;</span>
              </button>
            </div>
          </div>

          {/* QR Display & Real-Time Status */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-8 flex flex-col items-center text-center space-y-6">
              {qrSession ? (
                <>
                  <div className="p-4 bg-white rounded-2xl shadow-2xl">
                    <QrCodeSvg value={qrSession.qrPayload} size={240} />
                  </div>

                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border">
                      <span className="w-2 h-2 rounded-full animate-ping bg-blue-400" />
                      <span className="text-slate-300">
                        Live Status:{' '}
                        <span
                          className={`uppercase font-extrabold ${
                            pollingStatus?.status === 'VERIFIED'
                              ? 'text-emerald-400'
                              : pollingStatus?.status === 'SCANNED'
                              ? 'text-amber-400'
                              : 'text-blue-400'
                          }`}
                        >
                          {pollingStatus?.status || 'PENDING'}
                        </span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 max-w-sm">
                      Scan this code with the ZK-Trust Mobile or Web Wallet to fulfill the requirement.
                    </p>
                  </div>

                  {pollingStatus?.status === 'VERIFIED' && (
                    <div className="w-full p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 space-y-3 text-left animate-in fade-in">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                        <span>Terminal Verified! Entry Permitted.</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                        <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                          <span className="text-slate-500 block text-[10px] uppercase font-sans">Type</span>
                          <span className="text-slate-200">{pollingStatus.result_payload?.credentialType}</span>
                        </div>
                        <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                          <span className="text-slate-500 block text-[10px] uppercase font-sans">Security</span>
                          <span className="text-emerald-400 font-bold">ANTI-REPLAY OK</span>
                        </div>
                        <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                          <span className="text-slate-500 block text-[10px] uppercase font-sans">Revocation</span>
                          <span className="text-emerald-400 font-bold">ACTIVE</span>
                        </div>
                        <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
                          <span className="text-slate-500 block text-[10px] uppercase font-sans">Data Leaked</span>
                          <span className="text-cyan-400 font-bold">0 BYTES</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-20 text-slate-500 text-xs">Generating verification challenge...</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ================= TAB 2: WALLET SCANNER ================= */
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-8 space-y-6">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Scan className="w-5 h-5 text-blue-400" />
              <span>Camera & Payload Scanner</span>
            </h2>

            <div className="space-y-3">
              <label className="text-xs text-slate-400 font-medium block">
                QR Payload String / Deep Link:
              </label>
              <textarea
                rows={3}
                value={scannedPayload}
                onChange={(e) => {
                  setScannedPayload(e.target.value);
                  try {
                    setParsedSession(JSON.parse(e.target.value));
                    setWalletError(null);
                  } catch (err) {
                    setParsedSession(null);
                  }
                }}
                placeholder='Paste raw zktrust:// payload or JSON here...'
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            {parsedSession && (
              <div className="p-5 rounded-2xl bg-slate-950 border border-blue-500/30 space-y-3 text-xs">
                <div className="text-xs font-bold text-blue-400 uppercase tracking-wide">
                  Challenge Request Detected
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono">
                  <div>
                    <span className="text-slate-500 text-[10px] block font-sans">Verifier</span>
                    <span className="text-slate-200">{parsedSession.verifierName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block font-sans">Required Type</span>
                    <span className="text-cyan-400 font-bold">{parsedSession.credentialType}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 text-slate-400 text-[11px]">
                  Nonce: <span className="font-mono text-slate-300">{parsedSession.nonce.slice(0, 16)}...</span>
                </div>
              </div>
            )}

            {walletError && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{walletError}</span>
              </div>
            )}

            <button
              onClick={handleSubmitProof}
              disabled={submittingProof || !parsedSession}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {submittingProof ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Submitting Cryptographic Proof...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Authorize & Submit ZK Proof</span>
                </>
              )}
            </button>

            {submitResult && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-300 text-xs">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{submitResult.message} Terminal has been unlocked.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
