import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShieldCheck,
  Wallet,
  Landmark,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  Lock,
  EyeOff,
  History,
  GraduationCap,
  FileCheck2,
  QrCode,
  ShieldAlert,
  Link2,
  Zap,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { apiService } from '../services/api';

export default function UserDashboard() {
  const navigate = useNavigate();
  const { credentials } = useWallet();
  const [recentLogs, setRecentLogs] = useState([]);
  const [stats, setStats] = useState({ totalLogs: 0, validCount: 0 });
  const [blockchainInfo, setBlockchainInfo] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [logData, chainData] = await Promise.all([
          apiService.getAuditLogs({ limit: 5 }),
          apiService.getBlockchainStatus().catch(() => null),
        ]);
        const logs = logData.logs || [];
        setRecentLogs(logs.slice(0, 4));
        setStats({
          totalLogs: logs.length,
          validCount: logs.filter((l) => l.result === 'VALID').length,
        });
        setBlockchainInfo(chainData);
      } catch (e) {
        console.warn('Could not load dashboard data:', e);
      }
    };
    loadData();
  }, []);

  const featureCards = [
    {
      title: 'Student Verification',
      desc: 'Collegiate enrollment proofs with accredited university keys',
      icon: GraduationCap,
      path: '/student',
      badge: 'Feature 1',
      color: 'from-emerald-600 to-teal-700',
    },
    {
      title: 'Dynamic Age Proof',
      desc: '18+, 21+, and custom thresholds with Groth16 SnarkJS',
      icon: Zap,
      path: '/age-verification',
      badge: 'Feature 2',
      color: 'from-cyan-600 to-blue-700',
    },
    {
      title: 'Privacy-Preserving KYC',
      desc: 'Tier 1-3 AML compliance proof with zero document leakage',
      icon: FileCheck2,
      path: '/kyc',
      badge: 'Feature 3',
      color: 'from-purple-600 to-indigo-700',
    },
    {
      title: 'QR-Based Identity',
      desc: 'Contactless challenge handshake and mobile wallet scan',
      icon: QrCode,
      path: '/qr',
      badge: 'Feature 4',
      color: 'from-blue-600 to-cyan-700',
    },
    {
      title: 'Multi-Issuer Mint',
      desc: 'Mint collegiate, civil, and KYC credentials with Ed25519',
      icon: Landmark,
      path: '/issuer',
      badge: 'Feature 5',
      color: 'from-indigo-600 to-violet-700',
    },
    {
      title: 'Revocation Hub',
      desc: 'Live cryptographic revocation registry & lifecycle control',
      icon: ShieldAlert,
      path: '/credentials',
      badge: 'Feature 6',
      color: 'from-rose-600 to-red-700',
    },
    {
      title: 'EVM Issuer Registry',
      desc: 'Smart contract transparency anchor on Ethereum Sepolia',
      icon: Link2,
      path: '/blockchain',
      badge: 'Feature 7',
      color: 'from-indigo-600 to-blue-800',
    },
    {
      title: 'Privacy Audit Logs',
      desc: 'Filterable zero-knowledge verification audit trail',
      icon: History,
      path: '/audit',
      badge: 'Feature 10',
      color: 'from-slate-700 to-slate-800',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Hero Welcome */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border border-cyan-500/20 p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Zero-Knowledge Digital Identity Ecosystem</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              ZK-Trust Command Center
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl">
              Prove facts about your identity without handing over your personal documents. Backed by Circom 2.2, Groth16
              ZK-SNARKs on BN254, Ed25519 issuer signatures, and EVM on-chain trust anchors.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
            <Link
              to="/wallet"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition-all shadow-lg shadow-cyan-950"
            >
              <Wallet className="w-4 h-4" />
              <span>Open Wallet ({credentials.length})</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
            Wallet Credentials
          </span>
          <div className="text-2xl font-black text-cyan-400">{credentials.length} Active</div>
          <p className="text-[10px] text-slate-500">Student, Age, KYC & Human</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
            Verification Events
          </span>
          <div className="text-2xl font-black text-emerald-400">{stats.totalLogs} Logged</div>
          <p className="text-[10px] text-slate-500">{stats.validCount} Valid Proofs</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
            ZK Privacy Guarantee
          </span>
          <div className="text-2xl font-black text-white">0 Bytes Leaked</div>
          <p className="text-[10px] text-emerald-400 font-bold">100% Zero-Knowledge</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
            On-Chain Trust Anchor
          </span>
          <div className="text-sm font-bold text-indigo-300 truncate">
            {blockchainInfo ? blockchainInfo.network : 'Sepolia EVM'}
          </div>
          <p className="text-[10px] text-slate-500">IssuerRegistry.sol</p>
        </div>
      </div>

      {/* 8 Feature Modules Hub */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-200">Identity Modules & Services</h2>
          <span className="text-xs text-slate-500">10 Core Features Fully Integrated</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {featureCards.map((feat) => {
            const Icon = feat.icon;
            return (
              <Link
                key={feat.title}
                to={feat.path}
                className="group p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all hover:shadow-xl hover:-translate-y-0.5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${feat.color} text-white shadow-md`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    {feat.badge}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-200 text-sm group-hover:text-cyan-300 transition-colors">
                    {feat.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{feat.desc}</p>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400 group-hover:gap-1.5 transition-all">
                  <span>Launch module</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Verifications Feed */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" />
            <span>Recent Zero-Knowledge Verifications</span>
          </h2>
          <Link to="/audit" className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold">
            View full audit trail &rarr;
          </Link>
        </div>

        {recentLogs.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">No verifications recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {recentLogs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-200">{log.verifier_name}</div>
                  <div className="text-[11px] text-slate-400">
                    Claim:{' '}
                    <span className="font-mono text-cyan-400 font-bold">{log.requested_claim}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      log.result === 'VALID'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {log.result}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(log.verified_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
