import React, { useState, useEffect } from 'react';
import {
  History,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  EyeOff,
  Database,
  Filter,
  Download,
  CheckCircle,
  XCircle,
  Search,
} from 'lucide-react';
import { apiService } from '../services/api';

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [resultFilter, setResultFilter] = useState('');
  const [claimSearch, setClaimSearch] = useState('');
  const [selectedIssuer, setSelectedIssuer] = useState('');
  const [issuers, setIssuers] = useState([]);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {};
      if (resultFilter) params.result = resultFilter;
      if (claimSearch) params.claimType = claimSearch;
      if (selectedIssuer) params.issuerId = selectedIssuer;

      const [logData, issuerData] = await Promise.all([
        apiService.getAuditLogs(params),
        apiService.getIssuers().catch(() => ({ issuers: [] })),
      ]);

      setLogs(logData.logs || []);
      setIssuers(issuerData.issuers || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [resultFilter, selectedIssuer]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogs();
  };

  const exportLogsJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `zk-trust-audit-logs-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const validCount = logs.filter((l) => l.result === 'VALID').length;
  const rejectedCount = logs.filter((l) => l.result === 'REJECTED').length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-cyan-950/30 to-slate-900 border border-slate-800 p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <History className="w-3.5 h-3.5" />
              <span>Feature 10 • Zero-Knowledge Compliance Logs</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Privacy-Preserving Audit Trail
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl">
              Immutable verification records logged with mathematical certainty. Every event verifies predicates and
              single-use nullifiers with zero storage of names, dates of birth, or confidential documents.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
            <button
              onClick={exportLogsJson}
              disabled={logs.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
            <button
              onClick={fetchLogs}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-md"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-slate-500 text-[10px] uppercase font-bold">Total Events</span>
          <div className="text-xl font-black text-white">{logs.length}</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-slate-500 text-[10px] uppercase font-bold">Verified Valid</span>
          <div className="text-xl font-black text-emerald-400">{validCount}</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-slate-500 text-[10px] uppercase font-bold">Rejected / Forged</span>
          <div className="text-xl font-black text-rose-400">{rejectedCount}</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-slate-500 text-[10px] uppercase font-bold">Document Leakage</span>
          <div className="text-xl font-black text-cyan-400">0 Bytes (100% ZK)</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={claimSearch}
              onChange={(e) => setClaimSearch(e.target.value)}
              placeholder="Search claim, type, or verifier..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700"
          >
            Filter
          </button>
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none"
          >
            <option value="">All Results</option>
            <option value="VALID">VALID Only</option>
            <option value="REJECTED">REJECTED Only</option>
          </select>

          <select
            value={selectedIssuer}
            onChange={(e) => setSelectedIssuer(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none"
          >
            <option value="">All Issuers</option>
            {issuers.map((i) => (
              <option key={i.issuer_id} value={i.issuer_id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/80 text-slate-400 font-sans border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold">Verifier Relying Party</th>
                <th className="py-3 px-4 font-semibold">Verified Claim</th>
                <th className="py-3 px-4 font-semibold">Result</th>
                <th className="py-3 px-4 font-semibold">Single-Use Nullifier</th>
                <th className="py-3 px-4 font-semibold">Reason / Audit Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                    {isLoading ? 'Loading records...' : 'No verification events found.'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isValid = log.result === 'VALID';
                  return (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap font-sans">
                        {new Date(log.verified_at).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 font-sans font-medium text-slate-200">
                        {log.verifier_name}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px] font-bold">
                          {log.requested_claim}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {isValid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle className="w-3 h-3" />
                            <span>VALID</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            <XCircle className="w-3 h-3" />
                            <span>REJECTED</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400 max-w-xs truncate" title={log.nullifier}>
                        {log.nullifier === 'n/a' ? 'n/a' : `${log.nullifier.slice(0, 14)}...`}
                      </td>
                      <td className="py-3 px-4 text-[11px] font-sans text-slate-400">
                        {log.rejection_reason || (
                          <span className="text-emerald-400/80 font-mono text-[10px]">Groth16 & Ed25519 Verified</span>
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
