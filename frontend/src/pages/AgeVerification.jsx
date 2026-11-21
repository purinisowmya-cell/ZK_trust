import React, { useState } from 'react';
import {
  ShieldCheck,
  Calendar,
  Zap,
  Lock,
  Cpu,
  CheckCircle,
  AlertCircle,
  Clock,
  EyeOff,
  Fingerprint,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { apiService } from '../services/api';
import { generateAgeProof } from '../services/zkProver';
import { Link } from 'react-router-dom';

export default function AgeVerification() {
  const { credentials } = useWallet();
  const [minAge, setMinAge] = useState(21);
  const [customAgeInput, setCustomAgeInput] = useState('21');
  const [generating, setGenerating] = useState(false);
  const [stage, setStage] = useState(''); // 'requesting', 'proving', 'verifying', 'done'
  const [proofTelemetry, setProofTelemetry] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [error, setError] = useState(null);

  // Find age credential in wallet
  const ageCredItem = credentials.find(
    (c) => c.credential?.credentialType === 'AGE' || !c.credential?.credentialType
  );

  const presets = [
    { label: '18+', value: 18, desc: 'Civil Rights & Voting Age' },
    { label: '21+', value: 21, desc: 'Financial Trading & Regulated Goods' },
    { label: '25+', value: 25, desc: 'Car Rental & Commercial Licensing' },
    { label: '65+', value: 65, desc: 'Senior Citizen Health & Retirement' },
  ];

  const handlePresetClick = (val) => {
    setMinAge(val);
    setCustomAgeInput(val.toString());
  };

  const handleCustomChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setCustomAgeInput(e.target.value);
    if (!isNaN(val) && val >= 0 && val <= 120) {
      setMinAge(val);
    }
  };

  const handleRunVerification = async () => {
    if (!ageCredItem) {
      setError('No Age Credential found in your wallet. Please issue one from the Issuer Portal first.');
      return;
    }

    if (ageCredItem.credential.status === 'REVOKED') {
      setError('Credential has been REVOKED by the issuer. Cannot produce valid proof.');
      return;
    }

    try {
      setGenerating(true);
      setError(null);
      setVerificationResult(null);
      setProofTelemetry(null);

      // Step 1: Request fresh challenge with chosen minAge threshold
      setStage('Requesting unique verifier challenge & anti-replay nonce...');
      const challenge = await apiService.createChallenge({
        verifierId: 'verifier:age-enhanced-portal',
        verifierName: `Compliance Verifier (${minAge}+ Policy)`,
        purpose: `Zero-Knowledge proof of age >= ${minAge}`,
        minAge,
      });

      // Step 2: Generate Groth16 ZK-SNARK proof locally in browser
      setStage(`Computing client-side Groth16 proof (Age >= ${minAge})...`);
      const userAge = ageCredItem.privateData.age;
      const userSecret = ageCredItem.privateData.secret;
      const userCommitment = ageCredItem.credential.commitment;

      const proofOutput = await generateAgeProof({
        privateAge: userAge,
        privateSecret: userSecret,
        publicCommitment: userCommitment,
        minAge: challenge.minAge,
        nonce: challenge.nonce,
      });

      setProofTelemetry({
        timeMs: proofOutput.executionTimeMs,
        nullifier: proofOutput.derivedNullifier,
        signals: proofOutput.publicSignals,
      });

      // Step 3: Verify proof on backend
      setStage('Submitting Groth16 proof & Ed25519 credential signature to backend...');
      const verifyRes = await apiService.verifyProof({
        requestId: challenge.requestId,
        proof: proofOutput.proof,
        publicSignals: proofOutput.publicSignals,
        credentialPayload: {
          credentialId: ageCredItem.credential.credentialId,
          issuerId: ageCredItem.credential.issuerId,
          commitment: ageCredItem.credential.commitment,
          issuedAt: ageCredItem.credential.issuedAt,
          expiresAt: ageCredItem.credential.expiresAt,
        },
        issuerSignature: ageCredItem.credential.issuerSignature,
      });

      setVerificationResult(verifyRes);
      setStage('done');
    } catch (err) {
      console.error('Age verification failed:', err);
      setError(err.response?.data?.error || err.message || 'Verification failed.');
      setStage('');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-slate-900 border border-cyan-500/20 p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Zap className="w-3.5 h-3.5" />
              <span>Feature 2 • Dynamic Threshold ZK Verification</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Dynamic Age Verification
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl">
              Prove you meet 18+, 21+, or any custom age requirement using real Groth16 SNARKs without revealing your
              date of birth, exact age, or identity documents.
            </p>
          </div>

          <Link
            to="/issuer?type=AGE"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition-all shadow-lg shadow-cyan-900/30 shrink-0 self-start md:self-auto"
          >
            <span>Issue Identity Credential</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Policy Selector */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-6">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-400" />
              <span>Verification Policy</span>
            </h2>

            {/* Presets */}
            <div className="grid grid-cols-2 gap-2.5">
              {presets.map((p) => (
                <button
                  key={p.value}
                  onClick={() => handlePresetClick(p.value)}
                  className={`p-3 rounded-xl text-left border transition-all ${
                    minAge === p.value
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-white shadow-md shadow-cyan-950'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-lg font-black text-cyan-400">{p.label}</div>
                  <div className="text-[10px] text-slate-400 line-clamp-1">{p.desc}</div>
                </button>
              ))}
            </div>

            {/* Custom Input */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="text-xs text-slate-400 font-medium block">
                Custom Minimum Age Policy:
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="13"
                  max="100"
                  value={minAge}
                  onChange={(e) => handlePresetClick(parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-400"
                />
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={customAgeInput}
                  onChange={handleCustomChange}
                  className="w-16 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300 font-bold text-center text-sm"
                />
              </div>
            </div>

            {/* Loaded Credential Status */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs">
              <span className="text-slate-500 uppercase text-[10px] block font-semibold">Wallet Status</span>
              {ageCredItem ? (
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Credential:</span>
                    <span className="font-mono text-cyan-400">{ageCredItem.credential.credentialId.slice(0, 14)}...</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Your Age (Private):</span>
                    <span className="font-mono text-emerald-400">{ageCredItem.privateData.age} years</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Eligible for &ge; {minAge}:</span>
                    <span
                      className={`font-bold ${
                        ageCredItem.privateData.age >= minAge ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {ageCredItem.privateData.age >= minAge ? 'YES' : 'NO (Will Reject)'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500">No active credential in wallet.</p>
              )}
            </div>

            {/* Privacy Badges */}
            <div className="space-y-2 text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <EyeOff className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Zero date-of-birth or exact age disclosure</span>
              </div>
              <div className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>BN254 Circom constraint & Groth16 SnarkJS</span>
              </div>
              <div className="flex items-center gap-2">
                <Fingerprint className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Single-use nullifier prevents replay tracking</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Execution & Telemetry */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-6">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              <span>Cryptographic Proof Execution</span>
            </h2>

            {error && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {generating && (
              <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center gap-3 text-cyan-300 text-xs animate-pulse">
                <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0" />
                <span>{stage}</span>
              </div>
            )}

            <button
              onClick={handleRunVerification}
              disabled={generating || !ageCredItem}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-lg shadow-cyan-950 flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              <span>Generate & Prove: Age &ge; {minAge}</span>
            </button>

            {/* Proof Telemetry Card */}
            {proofTelemetry && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-sans font-semibold text-slate-300">Client Groth16 Telemetry</span>
                  <span className="text-emerald-400 font-bold">{proofTelemetry.timeMs} ms</span>
                </div>
                <div className="p-2.5 rounded bg-slate-900 border border-slate-800/80 text-[11px] text-slate-300 break-all">
                  <span className="text-slate-500 block text-[10px] font-sans">Single-Use Anti-Replay Nullifier</span>
                  {proofTelemetry.nullifier}
                </div>
              </div>
            )}

            {/* Verification Result */}
            {verificationResult && (
              <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-4 animate-in fade-in">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span>Backend Cryptographic Verification PASSED!</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase font-sans">Policy Satisfied</span>
                    <span className="text-emerald-400 font-bold">{verificationResult.claim}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase font-sans">Issuer Signature</span>
                    <span className="text-emerald-400 font-bold">Ed25519 OK</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase font-sans">Groth16 Snark</span>
                    <span className="text-cyan-400 font-bold">BN254 VALID</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase font-sans">Anti-Replay</span>
                    <span className="text-emerald-400 font-bold">CONSUMED</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
