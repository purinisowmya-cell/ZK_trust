import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, User, Landmark, CheckCircle2, History, Activity } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { apiService } from '../services/api';

export default function Navbar() {
  const { currentRole, setCurrentRole, credential } = useWallet();
  const location = useLocation();
  const [backendOnline, setBackendOnline] = useState(false);

  useEffect(() => {
    const checkApi = async () => {
      try {
        await apiService.checkHealth();
        setBackendOnline(true);
      } catch (e) {
        setBackendOnline(false);
      }
    };
    checkApi();
    const interval = setInterval(checkApi, 10000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: 'wallet', path: '/wallet', label: 'User Wallet', icon: User, role: 'user' },
    { id: 'issuer', path: '/issuer', label: 'Issuer Portal', icon: Landmark, role: 'issuer' },
    { id: 'verifier', path: '/verifier', label: 'Verifier Portal', icon: CheckCircle2, role: 'verifier' },
    { id: 'audit', path: '/audit', label: 'Privacy Audit', icon: History, role: null },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#070b14]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 group-hover:border-cyan-400 transition-colors">
              <Shield className="w-6 h-6 text-cyan-400" />
              <div className="absolute inset-0 bg-cyan-400/20 blur-md rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-cyan-300 bg-clip-text text-transparent">
                  ZK-Trust
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-full">
                  Groth16 ZK
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Prove What's Needed. Protect What's Private.
              </p>
            </div>
          </Link>

          {/* Navigation Links / Roles */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.id}
                  to={item.path}
                  onClick={() => {
                    if (item.role) setCurrentRole(item.role);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                  {item.id === 'wallet' && credential && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Backend Status Indicator */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs border border-slate-800 bg-[#0c1322]/80">
              <span
                className={`w-2 h-2 rounded-full ${
                  backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className="text-slate-400">
                Backend: <strong className={backendOnline ? 'text-emerald-400' : 'text-rose-400'}>{backendOnline ? 'Online' : 'Offline'}</strong>
              </span>
            </div>
          </div>

        </div>
      </div>
    </header>
  );
}
