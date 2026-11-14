import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  KeyRound,
  Trash2,
  FileCheck,
  Clock,
  Fingerprint,
  AlertCircle,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { apiService } from '../services/api';
import { generateAgeProof } from '../services/zkProver';
import ConsentModal from '../components/ConsentModal';

export default function WalletPage() {
  const {
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
  } = useWallet();

  const [showPrivateDetails, setShowPrivateDetails] = useState(false);
  const [isIssuingDefault, setIsIssuingDefault] = useState(false);
  const [isProving, setIsProving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Quick helper to issue demo credential (Age 21) if wallet is empty
  const handleQuickIssue = async () => {
    setIsIssuingDefault(true);
    setErrorMessage(null);
    try {
      const data = await apiService.issueCredential({
        fullName: 'Alex Vance (Test Citizen)',
        dateOfBirth: '2005-05-14',
        age: 21,
      });
      saveWalletCredential(data.credential, data.privateData);
    } catch (err) {
      setErrorMessage(err.response?.data?.error || err.message);
    } finally {
      setIsIssuingDefault(false);
    }
  };

  // Launch a demo verification request directly from wallet
  const handleTriggerDemoChallenge = async (minAge) => {
    setErrorMessage(null);
    setVerificationResult(null);
    try {
      const challenge = await apiService.createChallenge({
        verifierName: minAge === 21 ? 'FinTech Banking Services' : 'CyberID Club Portal',
        purpose: `Legal age compliance check (minimum ${minAge} years old)`,
        minAge,
      });
      setActiveChallenge(challenge);
      setConsentModalOpen(true);
    } catch (err) {
      setErrorMessage(err.response?.data?.error || err.message);
    }
  };

  // User consents to proof generation
  const handleApproveConsent = async () => {
    if (!activeChallenge || !credential || !privateData) return;
    setIsProving(true);
    setErrorMessage(null);

    try {
      console.log('Generating proof for minAge:', activeChallenge.minAge);
      // 1. Generate Groth16 proof inside user browser
      const proofResult = await generateAgeProof({
        privateAge: privateData.age,
        privateSecret: privateData.secret,
        publicCommitment: credential.commitment,
        minAge: activeChallenge.minAge,
        nonce: activeChallenge.nonce,
      });

      console.log('Proof generated, submitting to Verifier backend...');

      // 2. Submit to backend for cryptographic verification
      const verifyRes = await apiService.verifyProof({
        requestId: activeChallenge.requestId,
        proof: proofResult.proof,
        publicSignals: proofResult.publicSignals,
        credentialPayload: {
          credentialId: credential.credentialId,
          issuerId: credential.issuerId,
          commitment: credential.commitment,
          issuedAt: credential.issuedAt,
          expiresAt: credential.expiresAt,
        },
        issuerSignature: credential.issuerSignature,
      });

      setVerificationResult({
        ...verifyRes,
        executionTimeMs: proofResult.executionTimeMs,
        publicSignals: proofResult.publicSignals,
      });
      setConsentModalOpen(false);
    } catch (err) {
      const errText = err.response?.data?.error || err.message;
      setErrorMessage(errText);
      setVerificationResult({
        verified: false,
        error: errText,
      });
      setConsentModalOpen(false);
    } finally {
      setIsProving(false);
    }
  };

  const handleRejectConsent = () => {
    setConsentModalOpen(false);
    setErrorMessage('Verification rejected by user. No proof was generated.');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      
      {/* Page Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
            <Fingerprint className="w-8 h-8 text-cyan-400" />
            <span>Digital Identity Wallet</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Store and manage your verified credentials with zero-knowledge cryptographic protection.
          </p>
        </div>

        {credential && (
          <button
            onClick={clearWallet}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 rounded-lg transition-colors self-start sm:self-center"
          >
            <Trash2 className="w-4 h-4" />
            <span>Reset Demo Wallet</span>
          </button>
        )}
      </div>

      {/* Error / Alert banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
          <div className="flex-1">
            <strong>Verification Notice:</strong> {errorMessage}
          </div>
        </div>
      )}

      {/* Wallet State: Empty vs Populated */}
      {!credential ? (
        <div className="cyber-card p-8 sm:p-12 text-center max-w-xl mx-auto space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <KeyRound className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-white mb-2">No Credential Found in Wallet</h2>
            <p className="text-sm text-slate-400">
              To test private age verification, issue a synthetic demo credential. You will receive an authentic Ed25519 issuer-signed commitment.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={handleQuickIssue}
              disabled={isIssuingDefault}
              className="cyber-btn-primary w-full sm:w-auto"
            >
              {isIssuingDefault ? (
                <>
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Issuing Demo ID...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Quick Issue Demo ID (Age 21)</span>
                </>
              )}
            </button>

            <Link to="/issuer" className="cyber-btn-secondary w-full sm:w-auto">
              <span>Custom Issuer Portal</span>
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Credential Card (Left / 2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Identity Card UI */}
            <div className="cyber-card p-6 bg-gradient-to-br from-[#0c1322] to-[#141e34] border-cyan-500/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-700/60">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Verified Identity Credential</h3>
                    <p className="text-xs text-slate-400">{credential.issuerId}</p>
                  </div>
                </div>

                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  {credential.status}
                </span>
              </div>

              {/* Public Commitment & Metadata */}
              <div className="my-5 space-y-3 font-mono text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">Credential ID:</span>
                  <div className="p-2 bg-[#070b14]/70 rounded border border-slate-800 text-slate-300 break-all select-all">
                    {credential.credentialId}
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Poseidon Commitment Hash:</span>
                  <div className="p-2 bg-[#070b14]/70 rounded border border-cyan-500/30 text-cyan-300 break-all select-all font-semibold">
                    {credential.commitment}
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Ed25519 Issuer Signature:</span>
                  <div className="p-2 bg-[#070b14]/70 rounded border border-slate-800 text-slate-400 break-all select-all text-[11px]">
                    {credential.issuerSignature}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="text-slate-400">
                    <span>Issued At: </span>
                    <strong className="text-slate-300">{new Date(credential.issuedAt).toLocaleDateString()}</strong>
                  </div>
                  <div className="text-slate-400">
                    <span>Expires At: </span>
                    <strong className="text-slate-300">{new Date(credential.expiresAt).toLocaleDateString()}</strong>
                  </div>
                </div>
              </div>

              {/* Private Details Review Section */}
              <div className="pt-4 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setShowPrivateDetails(!showPrivateDetails)}
                  className="flex items-center gap-2 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  {showPrivateDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span>{showPrivateDetails ? 'Hide Private Witness Data' : 'Review My Private Witness Data (Stored in Local Browser)'}</span>
                </button>

                {showPrivateDetails && (
                  <div className="mt-4 p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 text-xs space-y-2 animate-in fade-in duration-200">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Full Name (Demo):</span>
                      <strong className="text-white">{privateData.fullName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Exact Age:</span>
                      <strong className="text-cyan-300 font-bold">{privateData.age} Years Old</strong>
                    </div>
                    {privateData.dateOfBirth && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Date of Birth:</span>
                        <strong className="text-slate-200">{privateData.dateOfBirth}</strong>
                      </div>
                    )}
                    <div className="pt-2">
                      <span className="text-slate-400 block mb-1">Private Secret (Salt):</span>
                      <div className="p-2 bg-black/60 rounded border border-slate-800 text-slate-300 break-all select-all font-mono text-[11px]">
                        {privateData.secret}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 italic mt-2">
                      * Security Guarantee: This private data is held only in your local browser state and is NEVER transmitted over network during verification.
                    </p>
                  </div>
                )}
              </div>

            </div>

          </div>

          {/* Verification Testing Actions (Right / 1 col) */}
          <div className="space-y-6">
            <div className="cyber-card p-6 border-cyan-500/30">
              <h3 className="font-bold text-white text-base mb-2 flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-400" />
                <span>Simulate Age Verification</span>
              </h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Test the selective disclosure workflow. Verifier requests proof that you meet a policy threshold.
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => handleTriggerDemoChallenge(18)}
                  className="cyber-btn-primary w-full justify-between"
                >
                  <span>Prove Age ≥ 18</span>
                  <span className="text-xs opacity-80">(Valid for Age {privateData?.age})</span>
                </button>

                <button
                  onClick={() => handleTriggerDemoChallenge(21)}
                  className="cyber-btn-secondary w-full justify-between border-cyan-500/30 text-cyan-300"
                >
                  <span>Prove Age ≥ 21</span>
                  <span className="text-xs opacity-80">(Valid for Age {privateData?.age})</span>
                </button>

                <button
                  onClick={() => handleTriggerDemoChallenge(25)}
                  className="cyber-btn-secondary w-full justify-between border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                >
                  <span>Prove Age ≥ 25</span>
                  <span className="text-xs opacity-80 text-rose-400">(Fails for Age {privateData?.age})</span>
                </button>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-400 text-center">
                Want custom requests? Visit the{' '}
                <Link to="/verifier" className="text-cyan-400 hover:underline">
                  Verifier Portal
                </Link>
              </div>
            </div>

            {/* Live Verification Result Box */}
            {verificationResult && (
              <div
                className={`cyber-card p-5 border ${
                  verificationResult.verified
                    ? 'border-emerald-500/50 bg-emerald-950/20'
                    : 'border-rose-500/50 bg-rose-950/20'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  {verificationResult.verified ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
                  )}
                  <div>
                    <h4 className="font-bold text-sm text-white">
                      {verificationResult.verified ? 'Verification Succeeded' : 'Verification Rejected'}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {verificationResult.claim || 'Age Verification'}
                    </p>
                  </div>
                </div>

                {verificationResult.verified ? (
                  <div className="space-y-1.5 text-xs text-slate-300 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Groth16 Proof:</span>
                      <span className="text-emerald-400 font-semibold">VALID</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Issuer Ed25519:</span>
                      <span className="text-emerald-400 font-semibold">VALID</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Anti-Replay:</span>
                      <span className="text-emerald-400 font-semibold">NONCE CONSUMED</span>
                    </div>
                    {verificationResult.executionTimeMs && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Proving Time:</span>
                        <span className="text-cyan-300 font-semibold">
                          {verificationResult.executionTimeMs}ms
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-rose-300 mt-2">
                    {verificationResult.error || 'The cryptographic proof or signature failed verification.'}
                  </p>
                )}
              </div>
            )}

          </div>

        </div>
      )}

      {/* Consent Modal Triggered Before Proving */}
      <ConsentModal
        isOpen={consentModalOpen}
        challenge={activeChallenge}
        onApprove={handleApproveConsent}
        onReject={handleRejectConsent}
        isProving={isProving}
      />

    </div>
  );
}
