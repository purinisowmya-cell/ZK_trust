import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  User,
  Shield,
  Layers,
  Database,
  Trash2,
  CheckCircle,
  Globe,
  Key,
  Cpu,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';

export default function Settings() {
  const { currentRole, setCurrentRole, credentials, clearWallet } = useWallet();
  const [network, setNetwork] = useState('sepolia');
  const [savedMessage, setSavedMessage] = useState(null);

  const handleRoleChange = (role) => {
    setCurrentRole(role);
    setSavedMessage(`Switched active role to: ${role.toUpperCase()}`);
    setTimeout(() => setSavedMessage(null), 2500);
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear your local wallet credentials and private witness data?')) {
      clearWallet();
      setSavedMessage('Wallet data cleared.');
      setTimeout(() => setSavedMessage(null), 2500);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/60 p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-cyan-400">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">System Settings & Role Manager</h1>
        </div>
        <p className="text-slate-400 text-xs max-w-xl">
          Configure application roles, cryptographic test networks, API connections, and digital wallet storage.
        </p>
      </div>

      {savedMessage && (
        <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center gap-3 text-cyan-300 text-xs">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{savedMessage}</span>
        </div>
      )}

      {/* Role Switcher */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <User className="w-4 h-4 text-cyan-400" />
          <span>Current Active Persona</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { id: 'user', label: 'Citizen / Student', desc: 'Hold & prove credentials' },
            { id: 'issuer', label: 'Issuer Authority', desc: 'Mint university & ID credentials' },
            { id: 'verifier', label: 'Relying Verifier', desc: 'Request & check ZK proofs' },
            { id: 'admin', label: 'System Admin', desc: 'Revocation & blockchain logs' },
          ].map((r) => (
            <button
              key={r.id}
              onClick={() => handleRoleChange(r.id)}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                currentRole === r.id
                  ? 'bg-cyan-500/15 border-cyan-500/60 text-white shadow-md shadow-cyan-950'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="font-bold text-xs text-slate-200">{r.label}</div>
              <div className="text-[10px] text-slate-500 mt-1">{r.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* EVM Testnet Selector */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Globe className="w-4 h-4 text-cyan-400" />
          <span>Blockchain Anchor Network</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: 'sepolia', name: 'Ethereum Sepolia', chainId: 11155111, status: 'Active (Simulated/RPC)' },
            { id: 'amoy', name: 'Polygon Amoy', chainId: 80002, status: 'Supported' },
            { id: 'local', name: 'Local In-Memory EVM', chainId: 31337, status: 'Offline Mode' },
          ].map((net) => (
            <button
              key={net.id}
              onClick={() => setNetwork(net.id)}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                network === net.id
                  ? 'bg-indigo-500/15 border-indigo-500/60 text-white shadow-md shadow-indigo-950'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="font-bold text-xs text-slate-200">{net.name}</div>
              <div className="text-[10px] text-slate-500 mt-1">Chain: {net.chainId}</div>
              <div className="text-[10px] text-emerald-400 mt-0.5">{net.status}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Cryptographic Stack Info */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span>Cryptographic Engine Telemetry</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase font-sans">ZK Scheme</span>
            <span className="text-cyan-400 font-bold">Groth16 SNARK</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase font-sans">Elliptic Curve</span>
            <span className="text-emerald-400 font-bold">BN254 (alt_bn128)</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase font-sans">Commitment</span>
            <span className="text-indigo-400 font-bold">Poseidon Hash</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase font-sans">Signatures</span>
            <span className="text-purple-400 font-bold">Ed25519 SPKI</span>
          </div>
        </div>
      </div>

      {/* Wallet Storage Purge */}
      <div className="bg-slate-900/90 rounded-2xl border border-rose-500/20 p-6 space-y-4">
        <h2 className="text-sm font-bold text-rose-300 flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-rose-400" />
          <span>Reset Demo Wallet State</span>
        </h2>
        <p className="text-slate-400 text-xs">
          Clears all credentials ({credentials.length} currently saved in your browser local storage) and resets private
          witness keys.
        </p>
        <button
          onClick={handleClear}
          className="px-4 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all flex items-center gap-2"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Local Wallet Data</span>
        </button>
      </div>
    </div>
  );
}
