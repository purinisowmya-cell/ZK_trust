import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShieldCheck,
  ShieldAlert,
  Wallet,
  Landmark,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  Lock,
  Eye,
  EyeOff,
  History,
  Activity,
  UserCheck,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { apiService } from '../services/api';
import ConsentModal from '../components/ConsentModal';
import { generateAgeProof } from '../services/zkProver';

export default function UserDashboard() {
  const navigate = useNavigate();
  const {
    credential,
    privateData,
    saveWalletCredential,
    activeChallenge,
    setActiveChallenge,
    consentModalOpen,
    setConsentModalOpen,
  } = useWallet();

  const [recentLogs, setRecentLogs] = useState([]);
  const [stats, setStats] = useState({ totalLogs: 0, validCount: 0 });
  const [isProving, setIsProving] = useState(false);
  const [dashboardNotice, setDashboardNotice] = useState(null);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const data = await apiService.getAuditLogs();
        const logs = data.logs || [];
        setRecentLogs(logs.slice(0, 4));
        setStats({
          totalLogs: logs.length,
          validCount: logs.filter((l) => l.result === 'VALID').length,
        });
      } catch (e) {
        console.warn('Could not load logs for dashboard:', e);
      }
    };
    loadLogs();
  }, [consentModalOpen]);

  // Quick preset loading for demonstration
  const handleQuickLoadPreset = async (presetAge, presetName, presetDob) => {
    try {
      setDashboardNotice({ type: 'info', message: `Issuing persona for ${presetName} (Age ${presetAge})...` });
      const data = await apiService.issueCredential({
        fullName: presetName,
        age: presetAge,
        dateOfBirth: presetDob,
      });
      saveWalletCredential(data.credential, data.privateData);
      setDashboardNotice({
        type: 'success',
        message: `Successfully loaded identity: ${presetName} (Age ${presetAge}) with signed Ed25519 commitment.`,
      });
    } catch (err) {
      setDashboardNotice({
        type: 'error',
        message: `Failed to issue preset: ${err.response?.data?.error || err.message}`,
      });
    }
  };

  // Launch a simulated verification challenge for user to respond to
  const handleTriggerChallenge = async (minAge, orgName, purpose) => {
    try {
      const challenge = await apiService.createChallenge({
        verifierName: orgName,
        purpose,
        minAge,
      });
      setActiveChallenge(challenge);
      setConsentModalOpen(true);
    } catch (err) {
      setDashboardNotice({
        type: 'error',
        message: `Failed to create challenge: ${err.message}`,
      });
    }
  };

  const handleApproveProof = async () => {
    if (!activeChallenge || !credential || !privateData) return;
    setIsProving(true);
    try {
      const proofRes = await generateAgeProof({
        privateAge: privateData.age,
        privateSecret: privateData.secret,
        publicCommitment: credential.commitment,
        minAge: activeChallenge.minAge,
        nonce: activeChallenge.nonce,
      });

      const res = await apiService.verifyProof({
        requestId: activeChallenge.requestId,
        proof: proofRes.proof,
        publicSignals: proofRes.publicSignals,
        credentialPayload: {
          credentialId: credential.credentialId,
          issuerId: credential.issuerId,
          commitment: credential.commitment,
          issuedAt: credential.issuedAt,
          expiresAt: credential.expiresAt,
        },
        issuerSignature: credential.issuerSignature,
      });

      setConsentModalOpen(false);
      setDashboardNotice({
        type: 'success',
        message: `Verification SUCCESS: Verified claim "${res.claim}" for ${res.verifierName} in ${proofRes.executionTimeMs}ms with zero personal data disclosed!`,
      });
    } catch (err) {
      setConsentModalOpen(false);
      setDashboardNotice({
        type: 'error',
        message: `Verification Failed: ${err.response?.data?.error || err.message}`,
      });
    } finally {
      setIsProving(false);
    }
  };

  const handleRejectProof = () => {
    setConsentModalOpen(false);
    setDashboardNotice({
      type: 'info',
      message: 'Verification request was rejected by user. No proof was generated.',
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      
      {/* Top Welcome Banner */}
      <div className="cyber-card p-6 bg-gradient-to-r from-[#0c1322] via-[#141e34] to-[#0c1322] border-cyan-500/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Identity Holder Session</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              Welcome, {privateData ? privateData.fullName : 'Guest Citizen'}
            </h1>
            <p className="text-sm text-slate-400 max-w-xl">
              Your identity credentials are cryptographically protected by zero-knowledge proofs. Manage your verifiable credentials, incoming challenges, and disclosure consent.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link to="/wallet" className="cyber-btn-primary">
              <Wallet className="w-4 h-4" />
              <span>Identity Wallet</span>
            </Link>
            <Link to="/issuer" className="cyber-btn-secondary">
              <Landmark className="w-4 h-4" />
              <span>Issuer Portal</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Notice Banner */}
      {dashboardNotice && (
        <div
          className={`p-4 rounded-xl text-sm flex items-start gap-3 border ${
            dashboardNotice.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              : dashboardNotice.type === 'error'
              ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
              : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
          }`}
        >
          {dashboardNotice.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">{dashboardNotice.message}</div>
          <button
            onClick={() => setDashboardNotice(null)}
            className="text-xs opacity-70 hover:opacity-100 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* 4 Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Credential Status */}
        <div className="cyber-card p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Credential Status</span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-white flex items-center gap-2">
            {credential ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400">ACTIVE</span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                <span className="text-slate-400">Not Minted</span>
              </>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {credential ? 'Ed25519 Issuer Authenticated' : 'Issue a demo ID to start'}
          </p>
        </div>

        {/* Card 2: Age Claim Available */}
        <div className="cyber-card p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Verifiable Age Claim</span>
            <Lock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white">
            {privateData ? `Age ≥ 18 & ≥ 21` : 'N/A'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {privateData ? `True Age: ${privateData.age} (Zero-Knowledge)` : 'Requires credential'}
          </p>
        </div>

        {/* Card 3: Verifications Completed */}
        <div className="cyber-card p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Total Verifications</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold text-white">
            {stats.totalLogs} <span className="text-xs font-normal text-slate-400">({stats.validCount} valid)</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Anti-replay nullifiers tracked</p>
        </div>

        {/* Card 4: Privacy Health */}
        <div className="cyber-card p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Privacy Health Score</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400">100% SAFE</div>
          <p className="text-[11px] text-slate-500 mt-1">Zero birthdates disclosed</p>
        </div>

      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Left Column (2 Cols): Identity Credential Overview & Challenge Simulator */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Active Credential Snapshot */}
          <div className="cyber-card p-6 border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="font-bold text-white text-base flex items-center gap-2">
                <Wallet className="w-5 h-5 text-cyan-400" />
                <span>Primary Identity Credential</span>
              </h2>
              <Link to="/wallet" className="text-xs text-cyan-400 hover:underline flex items-center gap-1">
                <span>View Full Wallet</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {credential ? (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-[#141e34]/70 border border-slate-700/60 font-mono text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Issuer:</span>
                    <strong className="text-slate-200">{credential.issuerId}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Credential ID:</span>
                    <span className="text-slate-300">{credential.credentialId.slice(0, 20)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Poseidon Commitment:</span>
                    <span className="text-cyan-300 font-bold">{credential.commitment.slice(0, 16)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Expiry Date:</span>
                    <span className="text-slate-300">{new Date(credential.expiresAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span>Owner: <strong className="text-white">{privateData?.fullName}</strong></span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Ed25519 Signed</span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center space-y-3 bg-[#141e34]/40 rounded-xl border border-dashed border-slate-700">
                <p className="text-sm text-slate-300">You don't have an active credential yet.</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => handleQuickLoadPreset(21, 'Alex Vance', '2005-05-14')}
                    className="cyber-btn-primary text-xs"
                  >
                    Quick Mint Demo Citizen (Age 21)
                  </button>
                  <Link to="/issuer" className="cyber-btn-secondary text-xs">
                    Custom Mint in Issuer Portal
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Verification Challenge Inbound Queue */}
          <div className="cyber-card p-6 border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="font-bold text-white text-base flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <span>Simulate Inbound Verification Requests</span>
              </h2>
              <span className="text-xs text-slate-400">One-click interactive test</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Test how relying parties request compliance checks. Clicking any request will open the **User Consent Screen** before launching the in-browser Groth16 prover.
            </p>

            <div className="grid sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  handleTriggerChallenge(18, 'Age-Restricted Entertainment Portal', 'Compliance age confirmation (18+)')
                }
                className="p-3 text-left rounded-lg bg-[#141e34] hover:bg-[#1e2c4a] border border-slate-700 hover:border-cyan-500/40 transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white text-xs">Entertainment Service</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 font-bold">
                    Age ≥ 18
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Standard legal adult compliance check</p>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleTriggerChallenge(21, 'FinTech Trading Exchange', 'KYC age verification requirement (21+)')
                }
                className="p-3 text-left rounded-lg bg-[#141e34] hover:bg-[#1e2c4a] border border-slate-700 hover:border-cyan-500/40 transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white text-xs">FinTech Exchange</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 font-bold">
                    Age ≥ 21
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Strict regulatory compliance check</p>
              </button>
            </div>
          </div>

        </div>

        {/* Right Column (1 Col): Demo Persona Switcher & Recent History */}
        <div className="space-y-6">
          
          {/* Quick Demo Personas */}
          <div className="cyber-card p-6 border-slate-800 space-y-4">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Switch Demo Persona</span>
            </h3>
            <p className="text-xs text-slate-400">
              Instantly mint different personas to test boundary conditions and underage rejections.
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleQuickLoadPreset(21, 'Alex Vance', '2005-05-14')}
                className="w-full text-left p-2.5 rounded-lg bg-[#141e34] hover:bg-[#1e2c4a] border border-slate-700 text-xs transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-white">Alex Vance</div>
                  <div className="text-[11px] text-slate-400">Adult (Age 21) • Passes 18 & 21</div>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold">ADULT</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLoadPreset(17, 'Alice Minor', '2009-08-20')}
                className="w-full text-left p-2.5 rounded-lg bg-[#141e34] hover:bg-[#1e2c4a] border border-slate-700 text-xs transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-rose-300">Alice Minor</div>
                  <div className="text-[11px] text-slate-400">Minor (Age 17) • Circuit Rejects</div>
                </div>
                <span className="text-[10px] text-rose-400 font-bold">UNDERAGE</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLoadPreset(26, 'Marcus Miller', '2000-02-10')}
                className="w-full text-left p-2.5 rounded-lg bg-[#141e34] hover:bg-[#1e2c4a] border border-slate-700 text-xs transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-white">Marcus Miller</div>
                  <div className="text-[11px] text-slate-400">Senior Adult (Age 26)</div>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold">ADULT</span>
              </button>
            </div>
          </div>

          {/* Recent Privacy History Widget */}
          <div className="cyber-card p-6 border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-400" />
                <span>Recent Privacy Trail</span>
              </h3>
              <Link to="/audit" className="text-xs text-cyan-400 hover:underline">
                View All
              </Link>
            </div>

            {recentLogs.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No verification events yet.</p>
            ) : (
              <div className="space-y-2">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-lg bg-[#141e34]/70 border border-slate-800 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-slate-200">{log.verifier_name}</div>
                      <div className="text-[10px] text-slate-400">{log.requested_claim}</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.result === 'VALID'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {log.result}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Consent Modal for User Agency */}
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
