import React, { useState, useEffect } from 'react';
import {
  Link2,
  Cpu,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Layers,
  Copy,
  ShieldCheck,
  Globe,
  Database,
} from 'lucide-react';
import { apiService } from '../services/api';

export default function BlockchainRegistry() {
  const [status, setStatus] = useState(null);
  const [issuers, setIssuers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  const fetchBlockchainData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statusRes, issuersRes] = await Promise.all([
        apiService.getBlockchainStatus(),
        apiService.getAllOnchainIssuers(),
      ]);
      setStatus(statusRes);
      setIssuers(issuersRes.issuers || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch blockchain registry data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockchainData();
  }, []);

  const handleSync = async () => {
    try {
      setSyncing(true);
      await apiService.syncBlockchain();
      await fetchBlockchainData();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950/40 via-blue-950/30 to-slate-900 border border-indigo-500/20 p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              <Link2 className="w-3.5 h-3.5" />
              <span>Feature 7 • EVM Decentralized Trust Anchor</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Blockchain-Based Issuer Registry
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl">
              Public on-chain registry for trusted issuer identities and cryptographic keys. Provides censorship-resistant
              verification anchors on EVM testnets without storing any personal data on-chain.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-950"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Sync with EVM'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Network Metadata Card */}
      {status && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold uppercase tracking-wider">Network</span>
              <Globe className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-sm font-bold text-white">{status.network}</div>
            <div className="text-[10px] text-slate-500 font-mono">Chain ID: {status.chainId}</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold uppercase tracking-wider">Smart Contract</span>
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-xs font-mono text-indigo-300 truncate" title={status.contractAddress}>
              {status.contractAddress}
            </div>
            <div className="text-[10px] text-emerald-400 font-bold">VERIFIED ON-CHAIN</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold uppercase tracking-wider">Registry Mode</span>
              <Cpu className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-sm font-bold text-white">
              {status.mode === 'EVM_RPC_LIVE' ? 'EVM Testnet RPC' : 'Local EVM Fallback'}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">Block #{status.blockNumber}</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-semibold uppercase tracking-wider">Anchor Count</span>
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-lg font-black text-indigo-400">{status.activeIssuerCount} Active Issuers</div>
            <div className="text-[10px] text-slate-500 font-mono">Zero Personal Data</div>
          </div>
        </div>
      )}

      {/* On-Chain Issuers Table */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-400" />
            <span>On-Chain Verified Issuers ({issuers.length})</span>
          </h2>
          <span className="text-xs text-slate-500 font-mono">IssuerRegistry.sol</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/80 text-slate-400 font-sans border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Issuer Authority</th>
                <th className="py-3.5 px-4 font-semibold">Type</th>
                <th className="py-3.5 px-4 font-semibold">On-Chain Address</th>
                <th className="py-3.5 px-4 font-semibold">Tx Hash</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 font-semibold text-right">Key</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {issuers.map((issuer) => (
                <tr key={issuer.issuerId} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 font-sans font-semibold text-slate-200">
                    <div>{issuer.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{issuer.issuerId}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {issuer.issuerType}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400 truncate max-w-xs" title={issuer.onchainAddress}>
                    {issuer.onchainAddress.slice(0, 10)}...{issuer.onchainAddress.slice(-6)}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500 truncate max-w-xs" title={issuer.txHash}>
                    {issuer.txHash.slice(0, 8)}...{issuer.txHash.slice(-6)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      SYNCED
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => copyToClipboard(issuer.publicKeyPem, issuer.issuerId)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-sans transition-all"
                    >
                      {copiedKey === issuer.issuerId ? 'Copied!' : 'Copy Key'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
