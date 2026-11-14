import React, { useState, useEffect } from 'react';
import { History, ShieldCheck, ShieldAlert, RefreshCw, EyeOff, Database } from 'lucide-react';
import { apiService } from '../services/api';

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiService.getAuditLogs();
      setLogs(data.logs || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <History className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Privacy-Preserving Audit Trail
            </h1>
            <p className="text-sm text-slate-400">
              Immutable verification history logged with zero personally identifiable data.
            </p>
          </div>
        </div>

        <button
          onClick={fetchLogs}
          disabled={isLoading}
          className="cyber-btn-secondary text-xs self-start sm:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Audit Logs</span>
        </button>
      </div>

      {/* Privacy Guarantee Banner */}
      <div className="cyber-card p-5 border-emerald-500/30 bg-emerald-950/10 flex items-start gap-4">
        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
          <EyeOff className="w-6 h-6" />
        </div>
        <div className="space-y-1 text-xs sm:text-sm text-slate-300">
          <h3 className="font-bold text-white flex items-center gap-2">
            <span>Zero-Knowledge Data Protection Guarantee</span>
            <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
              COMPLIANT
            </span>
          </h3>
          <p className="text-slate-400 leading-relaxed">
            By cryptographic design, this audit table logs only nonces, public claims, and nullifiers. Exact date of birth, age, name, and identity documents are <strong className="text-slate-200">never stored or accessible</strong> to any verifier or database administrator.
          </p>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="cyber-card overflow-hidden border-slate-800">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <span>Verification Registry ({logs.length} Records)</span>
          </h2>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 text-rose-300 text-xs border-b border-rose-500/30">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#141e34]/80 text-slate-400 border-b border-slate-800 font-sans uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Verifier</th>
                <th className="py-3 px-4">Requested Claim</th>
                <th className="py-3 px-4">Result</th>
                <th className="py-3 px-4">Circuit Nullifier (Anti-Replay)</th>
                <th className="py-3 px-4">Details / Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-sans text-xs">
                    {isLoading ? 'Loading audit records...' : 'No verification events logged yet.'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isValid = log.result === 'VALID';
                  return (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {new Date(log.verified_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-sans font-medium text-slate-200">
                        {log.verifier_name}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                          {log.requested_claim}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {isValid ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <ShieldCheck className="w-3 h-3" />
                            <span>VALID</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            <ShieldAlert className="w-3 h-3" />
                            <span>REJECTED</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-400 max-w-xs truncate" title={log.nullifier}>
                        {log.nullifier === 'n/a' ? (
                          <span className="text-slate-600 font-sans">N/A</span>
                        ) : (
                          `${log.nullifier.slice(0, 14)}...${log.nullifier.slice(-6)}`
                        )}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-400 font-sans">
                        {log.rejection_reason || (
                          <span className="text-emerald-400/80">Groth16 & Ed25519 Verified</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
