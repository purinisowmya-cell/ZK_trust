import React from 'react';
import { ShieldCheck, EyeOff, CheckCircle, XCircle, AlertTriangle, Lock } from 'lucide-react';

export default function ConsentModal({
  isOpen,
  challenge,
  onApprove,
  onReject,
  isProving,
}) {
  if (!isOpen || !challenge) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="cyber-card w-full max-w-lg p-6 bg-[#0c1322] border-cyan-500/50 shadow-2xl shadow-cyan-500/20 relative">
        
        {/* Modal Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Identity Verification Consent
            </h3>
            <p className="text-xs text-slate-400">
              Review and approve what information will be disclosed.
            </p>
          </div>
        </div>

        {/* Verifier & Request Details */}
        <div className="my-5 p-4 rounded-xl bg-[#141e34]/70 border border-slate-700/60 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400">Relying Party (Verifier):</span>
            <span className="font-semibold text-slate-200">{challenge.verifierName}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400">Verification Purpose:</span>
            <span className="text-slate-300 italic">{challenge.purpose}</span>
          </div>
          <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-800">
            <span className="text-slate-400">Requested Claim:</span>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-full">
              Age ≥ {challenge.minAge} Years Old
            </span>
          </div>
        </div>

        {/* Privacy Comparison Table */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Will be disclosed */}
          <div className="p-3.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-2">
              <CheckCircle className="w-4 h-4" />
              <span>DISCLOSED TO VERIFIER</span>
            </div>
            <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
              <li>Mathematical ZK Proof</li>
              <li>Public Commitment Hash</li>
              <li>Claim statement (Age ≥ {challenge.minAge})</li>
              <li>Single-use request Nullifier</li>
            </ul>
          </div>

          {/* Will remain private */}
          <div className="p-3.5 rounded-lg bg-blue-950/20 border border-blue-500/30">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 mb-2">
              <EyeOff className="w-4 h-4" />
              <span>REMAINS 100% PRIVATE</span>
            </div>
            <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
              <li>Exact Date of Birth</li>
              <li>Your Exact Age</li>
              <li>Government ID / Names</li>
              <li>Cryptographic Salt/Secret</li>
            </ul>
          </div>
        </div>

        {/* Security Notice */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs mb-6">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            The Groth16 zero-knowledge proof will be computed directly inside your browser. No private witness data leaves your device.
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onReject}
            disabled={isProving}
            className="cyber-btn-secondary text-xs sm:text-sm px-4 py-2"
          >
            <XCircle className="w-4 h-4 text-rose-400" />
            <span>Reject Request</span>
          </button>

          <button
            type="button"
            onClick={onApprove}
            disabled={isProving}
            className="cyber-btn-primary text-xs sm:text-sm px-5 py-2"
          >
            {isProving ? (
              <>
                <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>Computing Groth16 Proof...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Approve & Generate Proof</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
