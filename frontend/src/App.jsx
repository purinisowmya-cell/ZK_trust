import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { WalletProvider } from './context/WalletContext';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import UserDashboard from './pages/UserDashboard';
import WalletPage from './pages/WalletPage';
import StudentVerification from './pages/StudentVerification';
import AgeVerification from './pages/AgeVerification';
import KycVerification from './pages/KycVerification';
import QrVerification from './pages/QrVerification';
import IssuerPortal from './pages/IssuerPortal';
import VerifierPortal from './pages/VerifierPortal';
import CredentialManagement from './pages/CredentialManagement';
import AuditLogPage from './pages/AuditLogPage';
import BlockchainRegistry from './pages/BlockchainRegistry';
import Settings from './pages/Settings';

export default function App() {
  return (
    <WalletProvider>
      <Router>
        <div className="flex flex-col min-h-screen bg-[#070b14] text-slate-100 font-sans">
          <Navbar />

          <main className="flex-1">
            <Routes>
              {/* Home & Dashboard */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/dashboard" element={<UserDashboard />} />
              <Route path="/wallet" element={<WalletPage />} />

              {/* Advanced Verification Features */}
              <Route path="/student" element={<StudentVerification />} />
              <Route path="/age-verification" element={<AgeVerification />} />
              <Route path="/kyc" element={<KycVerification />} />
              <Route path="/qr" element={<QrVerification />} />

              {/* Authority & Management */}
              <Route path="/issuer" element={<IssuerPortal />} />
              <Route path="/verifier" element={<VerifierPortal />} />
              <Route path="/credentials" element={<CredentialManagement />} />

              {/* Transparency & Settings */}
              <Route path="/audit" element={<AuditLogPage />} />
              <Route path="/blockchain" element={<BlockchainRegistry />} />
              <Route path="/settings" element={<Settings />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          <footer className="border-t border-slate-800/80 bg-[#070b14]/90 py-6 text-xs text-slate-500">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-400" />
                <span className="font-semibold text-slate-300">ZK-Trust Platform</span>
                <span>•</span>
                <span>Privacy-Preserving Digital Identity</span>
              </div>

              <div className="flex items-center gap-4 text-slate-400">
                <span>Theme: Cybersecurity, FinTech and Digital Trust</span>
                <span>•</span>
                <span className="text-cyan-400 font-mono">Circom 2.2 + Groth16 + BN254 + Ed25519</span>
              </div>
            </div>
          </footer>
        </div>
      </Router>
    </WalletProvider>
  );
}
