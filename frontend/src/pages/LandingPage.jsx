import React from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  Lock,
  EyeOff,
  CheckCircle,
  FileCheck2,
  RefreshCcw,
  ArrowRight,
  Database,
  Cpu,
  Fingerprint,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="space-y-20 pb-20">
      
      {/* Hero Section */}
      <section className="relative pt-12 pb-16 text-center max-w-4xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 mb-6 shadow-sm shadow-cyan-500/20">
          <Fingerprint className="w-3.5 h-3.5" />
          
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          Prove What's Needed.{' '}
          <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
            Protect What's Private.
          </span>
        </h1>

        <p className="text-base sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          The next-generation Zero-Knowledge digital identity verification system.
          Prove legal age thresholds (<strong className="text-slate-200">≥ 18 or ≥ 21</strong>) to verifiers using authentic issuer-signed credentials without disclosing your date of birth, exact age, or identity documents.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link to="/wallet" className="cyber-btn-primary px-6 py-3 text-base">
            <span>Launch Identity Wallet</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link to="/issuer" className="cyber-btn-secondary px-6 py-3 text-base">
            <span>Open Issuer Portal</span>
          </Link>
          <Link to="/verifier" className="cyber-btn-secondary px-6 py-3 text-base border-cyan-500/30 text-cyan-300">
            <span>Verifier Portal</span>
          </Link>
        </div>
      </section>

      {/* The Problem vs Our Solution */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Why Legacy Age Verification is Broken
          </h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Current systems force citizens to over-disclose sensitive identity data for simple boolean checks.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Legacy Broken Approach */}
          <div className="cyber-card p-6 border-rose-500/30 bg-rose-950/10">
            <div className="flex items-center gap-3 mb-4 text-rose-400 font-bold text-lg">
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30">
                <EyeOff className="w-5 h-5" />
              </div>
              <span>The Broken Legacy Flow</span>
            </div>
            <ul className="space-y-3 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">✕</span>
                <span>User hands over full physical ID card or passport scan.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">✕</span>
                <span>Exposes full name, home address, exact DOB, and ID numbers.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">✕</span>
                <span>Verifiers store unencrypted identity copies, creating massive honeypots for identity theft.</span>
              </li>
            </ul>
          </div>

          {/* ZK-Trust Solution */}
          <div className="cyber-card p-6 border-emerald-500/30 bg-emerald-950/10">
            <div className="flex items-center gap-3 mb-4 text-emerald-400 font-bold text-lg">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <Shield className="w-5 h-5" />
              </div>
              <span>The ZK-Trust Solution</span>
            </div>
            <ul className="space-y-3 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Zero personal data or dates disclosed: only a mathematical Groth16 proof.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Cryptographic Poseidon commitment signed with Ed25519 by trusted Issuer.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Single-use nonces and nullifiers prevent replay attacks and tracking.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Protocol Architecture Workflow */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            How ZK-Trust Operates Under the Hood
          </h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            A 4-step cryptographic pipeline connecting Issuers, Citizen Wallets, and Relying Parties.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Step 1 */}
          <div className="cyber-card p-5 relative overflow-hidden">
            <div className="text-3xl font-black text-slate-700/50 absolute top-3 right-4">01</div>
            <div className="p-2.5 w-fit rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-4">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Poseidon Commitment</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Issuer computes <code className="text-cyan-300 font-mono text-[11px]">Poseidon(age, secret)</code> and signs the canonical payload using an Ed25519 key.
            </p>
          </div>

          {/* Step 2 */}
          <div className="cyber-card p-5 relative overflow-hidden">
            <div className="text-3xl font-black text-slate-700/50 absolute top-3 right-4">02</div>
            <div className="p-2.5 w-fit rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 mb-4">
              <RefreshCcw className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Challenge & Consent</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Verifier issues a policy challenge (e.g. MinAge = 18) with a fresh nonce. User explicitly consents to proof generation.
            </p>
          </div>

          {/* Step 3 */}
          <div className="cyber-card p-5 relative overflow-hidden">
            <div className="text-3xl font-black text-slate-700/50 absolute top-3 right-4">03</div>
            <div className="p-2.5 w-fit rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">In-Browser Prover</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Circom Groth16 circuit generates the ZK proof inside the browser. Secret witness never touches any server or network.
            </p>
          </div>

          {/* Step 4 */}
          <div className="cyber-card p-5 relative overflow-hidden">
            <div className="text-3xl font-black text-slate-700/50 absolute top-3 right-4">04</div>
            <div className="p-2.5 w-fit rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-4">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Verifier Validation</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Backend verifies Ed25519 signature, checks Groth16 pairing equation, consumes nonce, and records audit trail without DOB.
            </p>
          </div>

        </div>
      </section>

      {/* Core Technical Highlights */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="cyber-card p-8 bg-gradient-to-br from-[#0c1322] to-[#141e34] border-cyan-500/40">
          <div className="grid lg:grid-cols-3 gap-8 items-center">
            
            <div className="lg:col-span-2 space-y-4">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                <CheckCircle className="w-4 h-4" />
                <span>Level 1 Unique Selling Propositions</span>
              </div>
              <h3 className="text-2xl font-bold text-white">
                Genuine Cryptographic Security & Anti-Replay
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Unlike simple mockups or cosmetic checks, ZK-Trust executes real pairing-friendly elliptic curve cryptography (BN254 curve). Tampering with a single signal or reusing a spent nonce triggers instant rejection.
              </p>
              <div className="grid sm:grid-cols-2 gap-4 pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-200">
                  <div className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>Real SnarkJS Groth16 pairing verification</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-200">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Deterministic Ed25519 canonical signatures</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-200">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span>Per-request nullifier double-spend guard</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-200">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Dual PostgreSQL / embedded storage engine</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 justify-center">
              <Link to="/wallet" className="cyber-btn-primary w-full text-center">
                Try Demo Scenario (Age 21)
              </Link>
              <Link to="/audit" className="cyber-btn-secondary w-full text-center">
                View Privacy Audit Trail
              </Link>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
}
