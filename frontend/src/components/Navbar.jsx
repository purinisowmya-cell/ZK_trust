import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Shield,
  LayoutDashboard,
  Wallet,
  Landmark,
  CheckCircle2,
  History,
  GraduationCap,
  FileCheck2,
  QrCode,
  ShieldAlert,
  Link2,
  Settings as SettingsIcon,
  ChevronDown,
  Menu,
  X,
  Zap,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { apiService } from '../services/api';

export default function Navbar() {
  const { credentials } = useWallet();
  const location = useLocation();
  const [backendOnline, setBackendOnline] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [proofsDropdownOpen, setProofsDropdownOpen] = useState(false);
  const [authorityDropdownOpen, setAuthorityDropdownOpen] = useState(false);

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

  const closeDropdowns = () => {
    setProofsDropdownOpen(false);
    setAuthorityDropdownOpen(false);
    setMobileMenuOpen(false);
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#070b14]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link to="/" onClick={closeDropdowns} className="flex items-center gap-3 group shrink-0">
            <div className="relative p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 group-hover:border-cyan-400 transition-colors">
              <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
              <div className="absolute inset-0 bg-cyan-400/20 blur-md rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base sm:text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-cyan-300 bg-clip-text text-transparent">
                  ZK-Trust
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-full">
                  Groth16 ZK
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden lg:block">
                Privacy-Preserving Digital Identity
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/dashboard"
              onClick={closeDropdowns}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                isActive('/dashboard')
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-cyan-400" />
              <span>Dashboard</span>
            </Link>

            <Link
              to="/wallet"
              onClick={closeDropdowns}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                isActive('/wallet')
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Wallet className="w-3.5 h-3.5 text-cyan-400" />
              <span>Wallet</span>
              {credentials.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300">
                  {credentials.length}
                </span>
              )}
            </Link>

            {/* Proofs Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setProofsDropdownOpen(!proofsDropdownOpen);
                  setAuthorityDropdownOpen(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                  ['/student', '/age-verification', '/kyc', '/qr'].includes(location.pathname)
                    ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-blue-400" />
                <span>ZK Proofs</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {proofsDropdownOpen && (
                <div className="absolute left-0 mt-2 w-52 bg-slate-900 rounded-xl border border-slate-800 p-2 shadow-2xl space-y-1 animate-in fade-in z-50">
                  <Link
                    to="/student"
                    onClick={closeDropdowns}
                    className="flex items-center gap-2.5 p-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <GraduationCap className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="font-semibold">Student Verification</div>
                      <div className="text-[10px] text-slate-500">Feature 1 • University ID</div>
                    </div>
                  </Link>
                  <Link
                    to="/age-verification"
                    onClick={closeDropdowns}
                    className="flex items-center gap-2.5 p-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <Zap className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="font-semibold">Dynamic Age Proof</div>
                      <div className="text-[10px] text-slate-500">Feature 2 • 18+, 21+, Custom</div>
                    </div>
                  </Link>
                  <Link
                    to="/kyc"
                    onClick={closeDropdowns}
                    className="flex items-center gap-2.5 p-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <FileCheck2 className="w-4 h-4 text-purple-400" />
                    <div>
                      <div className="font-semibold">Privacy KYC</div>
                      <div className="text-[10px] text-slate-500">Feature 3 • AML Tier 1-3</div>
                    </div>
                  </Link>
                  <Link
                    to="/qr"
                    onClick={closeDropdowns}
                    className="flex items-center gap-2.5 p-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <QrCode className="w-4 h-4 text-blue-400" />
                    <div>
                      <div className="font-semibold">QR Verification</div>
                      <div className="text-[10px] text-slate-500">Feature 4 • Scan & Handshake</div>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            {/* Authority Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setAuthorityDropdownOpen(!authorityDropdownOpen);
                  setProofsDropdownOpen(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                  ['/issuer', '/verifier', '/credentials'].includes(location.pathname)
                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Landmark className="w-3.5 h-3.5 text-indigo-400" />
                <span>Authorities</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {authorityDropdownOpen && (
                <div className="absolute left-0 mt-2 w-56 bg-slate-900 rounded-xl border border-slate-800 p-2 shadow-2xl space-y-1 animate-in fade-in z-50">
                  <Link
                    to="/issuer"
                    onClick={closeDropdowns}
                    className="flex items-center gap-2.5 p-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <Landmark className="w-4 h-4 text-indigo-400" />
                    <div>
                      <div className="font-semibold">Issuer Portal</div>
                      <div className="text-[10px] text-slate-500">Feature 5 • Multi-Issuer Mint</div>
                    </div>
                  </Link>
                  <Link
                    to="/verifier"
                    onClick={closeDropdowns}
                    className="flex items-center gap-2.5 p-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="font-semibold">Verifier Portal</div>
                      <div className="text-[10px] text-slate-500">Relying Party Verification</div>
                    </div>
                  </Link>
                  <Link
                    to="/credentials"
                    onClick={closeDropdowns}
                    className="flex items-center gap-2.5 p-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <div>
                      <div className="font-semibold">Revocation Hub</div>
                      <div className="text-[10px] text-slate-500">Feature 6 • Revoke Credentials</div>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            <Link
              to="/blockchain"
              onClick={closeDropdowns}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                isActive('/blockchain')
                  ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Link2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Blockchain</span>
            </Link>

            <Link
              to="/audit"
              onClick={closeDropdowns}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                isActive('/audit')
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <History className="w-3.5 h-3.5 text-slate-400" />
              <span>Audit Trail</span>
            </Link>

            <Link
              to="/settings"
              onClick={closeDropdowns}
              className={`p-1.5 rounded-lg text-xs font-semibold transition-colors ${
                isActive('/settings')
                  ? 'bg-slate-800 text-cyan-300 border border-slate-700'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title="System Settings"
            >
              <SettingsIcon className="w-4 h-4" />
            </Link>
          </nav>

          {/* Backend Status Indicator */}
          <div className="flex items-center gap-3">
            <div
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                backendOnline
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}
              />
              <span>{backendOnline ? 'Core API Online' : 'Core API Offline'}</span>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-[#070b14] px-4 py-4 space-y-2 text-xs font-semibold">
          <Link to="/dashboard" onClick={closeDropdowns} className="block p-2 rounded-lg hover:bg-slate-800">
            User Dashboard
          </Link>
          <Link to="/wallet" onClick={closeDropdowns} className="block p-2 rounded-lg hover:bg-slate-800">
            Digital Identity Wallet ({credentials.length})
          </Link>
          <Link to="/student" onClick={closeDropdowns} className="block p-2 rounded-lg hover:bg-slate-800 text-emerald-400">
            Student Verification (Feature 1)
          </Link>
          <Link to="/age-verification" onClick={closeDropdowns} className="block p-2 rounded-lg hover:bg-slate-800 text-cyan-400">
            Dynamic Age Proof (Feature 2)
          </Link>
          <Link to="/kyc" onClick={closeDropdowns} className="block p-2 rounded-lg hover:bg-slate-800 text-purple-400">
            Privacy KYC (Feature 3)
          </Link>
          <Link to="/qr" onClick={closeDropdowns} className="block p-2 rounded-lg hover:bg-slate-800 text-blue-400">
            QR Verification (Feature 4)
          </Link>
          <Link to="/issuer" onClick={closeDropdowns} className="block p-2 rounded-lg hover:bg-slate-800 text-indigo-400">
            Issuer Portal (Feature 5)
          </Link>
          <Link to="/verifier" onClick={closeDropdowns} className="block p-2 rounded-lg hover:bg-slate-800">
            Verifier Portal
          </Link>
          <Link to="/credentials" onClick={closeDropdowns} className="block p-2 rounded-lg hover:bg-slate-800 text-rose-400">
            Revocation Hub (Feature 6)
          </Link>
          <Link to="/blockchain" onClick={closeDropdowns} className="block p-2 rounded-lg hover:bg-slate-800 text-indigo-300">
            Blockchain Registry (Feature 7)
          </Link>
          <Link to="/audit" onClick={closeDropdowns} className="block p-2 rounded-lg hover:bg-slate-800">
            Privacy Audit Trail (Feature 10)
          </Link>
          <Link to="/settings" onClick={closeDropdowns} className="block p-2 rounded-lg hover:bg-slate-800">
            Settings
          </Link>
        </div>
      )}
    </header>
  );
}
