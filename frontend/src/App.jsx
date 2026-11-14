import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Shield, Github, Heart } from 'lucide-react';
import { WalletProvider } from './context/WalletContext';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import WalletPage from './pages/WalletPage';
import IssuerPortal from './pages/IssuerPortal';
import VerifierPortal from './pages/VerifierPortal';
import AuditLogPage from './pages/AuditLogPage';

export default function App() {
  return (
    <WalletProvider>
      <Router>
        <div className="flex flex-col min-h-screen">
          <Navbar />

          <main className="flex-1">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/issuer" element={<IssuerPortal />} />
              <Route path="/verifier" element={<VerifierPortal />} />
              <Route path="/audit" element={<AuditLogPage />} />
            </Routes>
          </main>

          <footer className="border-t border-slate-800/80 bg-[#070b14]/90 py-6 text-xs text-slate-500">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-400" />
                <span className="font-semibold text-slate-300">ZK-Trust Prototype</span>
                <span>•</span>
                <span>Hack With Aditya 2026</span>
              </div>

              <div className="flex items-center gap-4 text-slate-400">
                <span>Theme: Cybersecurity, FinTech and Digital Trust</span>
                <span>•</span>
                <span className="text-cyan-400 font-mono">Circom + Groth16 + BN254</span>
              </div>
            </div>
          </footer>
        </div>
      </Router>
    </WalletProvider>
  );
}
