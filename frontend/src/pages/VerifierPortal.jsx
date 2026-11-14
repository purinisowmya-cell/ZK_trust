import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Clock,
  Send,
  RefreshCcw,
  Bug,
  AlertTriangle,
  ArrowRight,
  EyeOff,
  Sliders,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { apiService } from '../services/api';
import { generateAgeProof } from '../services/zkProver';
import ConsentModal from '../components/ConsentModal';

export default function VerifierPortal() {
  const {
    credential,
    privateData,
    activeChallenge,
    setActiveChallenge,
    consentModalOpen,
    setConsentModalOpen,
  } = useWallet();

  const [verifierName, setVerifierName] = useState('FinTech Digital Exchange');
  const [purpose, setPurpose] = useState('Regulatory compliance verification for financial services');
  const [minAge, setMinAge] = useState(18);
  const [isCreatingChallenge, setIsCreatingChallenge] = useState(false);
  const [isProving, setIsProving] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [tamperMode, setTamperMode] = useState('none'); // 'none' | 'tamper_proof' | 'tamper_commitment' | 'tamper_issuer'
  const [errorMessage, setErrorMessage] = useState(null);

  // 1. Create a verification challenge
  const handleCreateChallenge = async (e) => {
    e?.preventDefault();
    setIsCreatingChallenge(true);
    setErrorMessage(null);
    setVerificationResult(null);

    try {
      const challenge = await apiService.createChallenge({
        verifierName,
        purpose,
        minAge: parseInt(minAge, 10),
      });
      setActiveChallenge(challenge);
    } catch (err) {
      setErrorMessage(err.response?.data?.error || err.message);
    } finally {
      setIsCreatingChallenge(false);
    }
  };

  // 2. Request user consent & proof from wallet
  const handleRequestProofFromUser = () => {
    if (!credential || !privateData) {
      setErrorMessage('User wallet has no credential! Please issue a credential first in User Wallet or Issuer Portal.');
      return;
    }
    setConsentModalOpen(true);
  };

  // 3. User approves in Consent Modal -> compute real proof & verify
  const handleApproveProof = async () => {
    if (!activeChallenge || !credential || !privateData) return;
    setIsProving(true);
    setErrorMessage(null);

    try {
      // Real in-browser Groth16 proof generation
      const proofResult = await generateAgeProof({
        privateAge: privateData.age,
        privateSecret: privateData.secret,
        publicCommitment: credential.commitment,
        minAge: activeChallenge.minAge,
        nonce: activeChallenge.nonce,
      });

      // Prepare payload with optional tamper simulation
      let proofToSend = proofResult.proof;
      let signalsToSend = [...proofResult.publicSignals];
      let credPayloadToSend = {
        credentialId: credential.credentialId,
        issuerId: credential.issuerId,
        commitment: credential.commitment,
        issuedAt: credential.issuedAt,
        expiresAt: credential.expiresAt,
      };
      let signatureToSend = credential.issuerSignature;

      if (tamperMode === 'tamper_proof') {
        // Corrupt an element in the proof
        proofToSend = {
          ...proofToSend,
          pi_a: ['123456789', proofToSend.pi_a[1], proofToSend.pi_a[2]],
        };
      } else if (tamperMode === 'tamper_commitment') {
        // Mismatch commitment
        credPayloadToSend.commitment = '99999999999999999999999999999999';
      } else if (tamperMode === 'tamper_issuer') {
        // Change to untrusted issuer
        credPayloadToSend.issuerId = 'did:zktrust:untrusted:malicious-actor';
      }

      const res = await apiService.verifyProof({
        requestId: activeChallenge.requestId,
        proof: proofToSend,
        publicSignals: signalsToSend,
        credentialPayload: credPayloadToSend,
        issuerSignature: signatureToSend,
      });

      setVerificationResult({
        ...res,
        executionTimeMs: proofResult.executionTimeMs,
        tamperMode,
      });
      setConsentModalOpen(false);
    } catch (err) {
      const errText = err.response?.data?.error || err.message;
      setErrorMessage(errText);
      setVerificationResult({
        verified: false,
        error: errText,
        tamperMode,
      });
      setConsentModalOpen(false);
    } finally {
      setIsProving(false);
    }
  };

  const handleRejectProof = () => {
    setConsentModalOpen(false);
    setErrorMessage('User rejected the verification request.');
    setVerificationResult({
      verified: false,
      error: 'User denied consent for proof generation.',
    });
  };

  // Replay Attack test helper
  const handleTestReplay = async () => {
    if (!verificationResult || !activeChallenge) {
      setErrorMessage('Perform a successful verification first to test replay protection.');
      return;
    }
    setErrorMessage(null);

    try {
      // Re-submit the same request
      await apiService.verifyProof({
        requestId: activeChallenge.requestId,
        proof: { pi_a: ['1','2','3'], pi_b: [['1','2'],['3','4']], pi_c: ['1','2'] },
        publicSignals: ['1','2','3','4'],
        credentialPayload: credential,
        issuerSignature: credential.issuerSignature,
      });
    } catch (err) {
      setVerificationResult({
        verified: false,
        error: `Replay Prevented: ${err.response?.data?.error || err.message}`,
        tamperMode: 'replay_test',
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      
      {/* Header */}
      <div className="pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Relying Party / Verifier Portal
            </h1>
            <p className="text-sm text-slate-400">
              Verify legal age policy claims using real Groth16 cryptographic pairings and Ed25519 issuer signatures.
            </p>
          </div>
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
          <div className="flex-1">{errorMessage}</div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        
        {/* Left Column: Challenge Generator & Tamper Controls */}
        <div className="space-y-6">
          
          {/* Challenge Generator Form */}
          <form onSubmit={handleCreateChallenge} className="cyber-card p-6 border-slate-800 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-400" />
              <span>1. Create Verification Challenge</span>
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Verifier Organization Name:
              </label>
              <input
                type="text"
                value={verifierName}
                onChange={(e) => setVerifierName(e.target.value)}
                required
                className="cyber-input text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Verification Purpose:
              </label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                required
                className="cyber-input text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Minimum Age Policy:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMinAge(18)}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                    minAge === 18
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                      : 'bg-[#141e34] text-slate-400 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  Age ≥ 18 (Legal Adult)
                </button>

                <button
                  type="button"
                  onClick={() => setMinAge(21)}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                    minAge === 21
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                      : 'bg-[#141e34] text-slate-400 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  Age ≥ 21 (Regulated/FinTech)
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isCreatingChallenge}
              className="cyber-btn-secondary w-full text-xs font-semibold py-2.5 mt-2"
            >
              <RefreshCcw className={`w-4 h-4 ${isCreatingChallenge ? 'animate-spin' : ''}`} />
              <span>Generate Fresh Nonce Challenge</span>
            </button>
          </form>

          {/* Tamper Testing Laboratory */}
          <div className="cyber-card p-6 border-slate-800 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Bug className="w-5 h-5 text-amber-400" />
              <span>Security & Tamper Simulation Lab</span>
            </h2>
            <p className="text-xs text-slate-400">
              Test how the backend verification engine handles fraudulent proofs and attacks.
            </p>

            <div className="space-y-2">
              <label className="flex items-center gap-3 p-2.5 rounded-lg bg-[#141e34] border border-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="tamper"
                  value="none"
                  checked={tamperMode === 'none'}
                  onChange={() => setTamperMode('none')}
                  className="text-cyan-500 focus:ring-cyan-400"
                />
                <span className="text-xs text-slate-200">Standard Legitimate Proof (Expected: VALID)</span>
              </label>

              <label className="flex items-center gap-3 p-2.5 rounded-lg bg-[#141e34] border border-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="tamper"
                  value="tamper_proof"
                  checked={tamperMode === 'tamper_proof'}
                  onChange={() => setTamperMode('tamper_proof')}
                  className="text-rose-500 focus:ring-rose-400"
                />
                <span className="text-xs text-rose-300">Corrupted Groth16 Proof (Expected: REJECTED)</span>
              </label>

              <label className="flex items-center gap-3 p-2.5 rounded-lg bg-[#141e34] border border-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="tamper"
                  value="tamper_commitment"
                  checked={tamperMode === 'tamper_commitment'}
                  onChange={() => setTamperMode('tamper_commitment')}
                  className="text-rose-500 focus:ring-rose-400"
                />
                <span className="text-xs text-rose-300">Mismatched Commitment (Expected: REJECTED)</span>
              </label>

              <label className="flex items-center gap-3 p-2.5 rounded-lg bg-[#141e34] border border-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="tamper"
                  value="tamper_issuer"
                  checked={tamperMode === 'tamper_issuer'}
                  onChange={() => setTamperMode('tamper_issuer')}
                  className="text-rose-500 focus:ring-rose-400"
                />
                <span className="text-xs text-rose-300">Untrusted / Rogue Issuer ID (Expected: REJECTED)</span>
              </label>
            </div>

            {verificationResult?.verified && (
              <button
                type="button"
                onClick={handleTestReplay}
                className="cyber-btn-danger w-full text-xs py-2 mt-2"
              >
                <span>Test Anti-Replay: Re-submit Same Request</span>
              </button>
            )}
          </div>

        </div>

        {/* Right Column: Active Challenge & Verification Engine Results */}
        <div className="space-y-6">
          
          {/* Active Challenge Card */}
          {activeChallenge ? (
            <div className="cyber-card p-6 border-cyan-500/40 bg-[#0c1322] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                  <ShieldAlert className="w-5 h-5" />
                  <span>2. Active Verification Challenge</span>
                </div>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  PENDING PROOF
                </span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block mb-0.5">Request ID:</span>
                  <div className="p-2 bg-black/60 rounded border border-slate-800 text-slate-300 break-all select-all">
                    {activeChallenge.requestId}
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">Cryptographic Nonce (Anti-Replay):</span>
                  <div className="p-2 bg-black/60 rounded border border-cyan-500/30 text-cyan-300 break-all select-all font-semibold">
                    {activeChallenge.nonce}
                  </div>
                </div>

                <div className="flex justify-between pt-1 text-slate-400">
                  <span>Required Policy:</span>
                  <strong className="text-white font-sans">Age ≥ {activeChallenge.minAge}</strong>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRequestProofFromUser}
                className="cyber-btn-primary w-full py-3 text-sm font-bold shadow-cyan-500/30"
              >
                <Send className="w-4 h-4" />
                <span>Request Proof & Open Consent Screen</span>
              </button>
            </div>
          ) : (
            <div className="cyber-card p-8 text-center text-slate-400 text-sm">
              Generate a verification challenge on the left to begin.
            </div>
          )}

          {/* Verification Result Card */}
          {verificationResult && (
            <div
              className={`cyber-card p-6 border space-y-4 animate-in fade-in duration-300 ${
                verificationResult.verified
                  ? 'border-emerald-500/50 bg-emerald-950/20'
                  : 'border-rose-500/50 bg-rose-950/20'
              }`}
            >
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                {verificationResult.verified ? (
                  <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-7 h-7 text-rose-400 shrink-0" />
                )}
                <div>
                  <h3 className="font-bold text-base text-white">
                    {verificationResult.verified ? 'Verification PASSED (Age Claim Satisfied)' : 'Verification REJECTED'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Mode: {verificationResult.tamperMode || 'standard'}
                  </p>
                </div>
              </div>

              {verificationResult.verified ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-black/40 border border-emerald-500/30 space-y-2 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400">1. Issuer Ed25519 Signature:</span>
                      <span className="text-emerald-400 font-bold">VALID (Authentic Authority)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">2. Commitment Binding:</span>
                      <span className="text-emerald-400 font-bold">MATCHES SIGNED PAYLOAD</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">3. Groth16 Pairing Math:</span>
                      <span className="text-emerald-400 font-bold">VALID (Elliptic Curve BN254)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">4. Single-Use Nonce & Nullifier:</span>
                      <span className="text-emerald-400 font-bold">REGISTERED (Anti-Replay)</span>
                    </div>
                  </div>

                  {/* Privacy Proof: What the verifier sees */}
                  <div className="p-3 rounded-lg bg-[#070b14]/70 border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center gap-2 text-cyan-400 font-semibold mb-1">
                      <EyeOff className="w-4 h-4" />
                      <span>Zero-Knowledge Privacy Guarantee:</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Exact User Age:</span>
                      <strong className="text-cyan-400">HIDDEN (Zero Witness Disclosed)</strong>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Date of Birth:</span>
                      <strong className="text-cyan-400">HIDDEN</strong>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>User Secret / Identity Document:</span>
                      <strong className="text-cyan-400">HIDDEN</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-black/40 border border-rose-500/30 text-xs text-rose-300 space-y-2">
                  <div className="font-semibold text-rose-400">Rejection Cause:</div>
                  <p className="font-mono">{verificationResult.error}</p>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

      {/* Consent Modal Trigger */}
      <ConsentModal
        isOpen={consentModalOpen}
        challenge={activeChallenge}
        onApprove={handleApproveProof}
        onReject={handleRejectProof}
        isProving={isProving}
      />

    </div>
  );
}
