import React, { useState } from 'react';
import {
  FileCheck2,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Building,
  Lock,
  Layers,
  ArrowRight,
  Info,
  BadgeAlert,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { apiService } from '../services/api';
import { Link } from 'react-router-dom';

export default function KycVerification() {
  const { credentials } = useWallet();
  const [targetTier, setTargetTier] = useState(2);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Find KYC credential in wallet
  const kycCredItem = credentials.find(
    (c) => c.credential?.credentialType === 'KYC'
  );

  const tiers = [
    {
      tier: 1,
      name: 'Tier 1: Basic ID Verification',
      desc: 'Government identity match & nationality confirmation',
      limit: '$1,000 / day transactions',
    },
    {
      tier: 2,
      name: 'Tier 2: Enhanced AML & Sanctions',
      desc: 'Sanctions check, PEP screening, and verified jurisdiction',
      limit: '$50,000 / day transactions',
    },
    {
      tier: 3,
      name: 'Tier 3: Institutional Biometric',
      desc: 'Liveness ISO-30107-3 compliant biometric audit & proof of address',
      limit: 'Unlimited enterprise volume',
    },
  ];

  const handleVerifyKyc = async () => {
    if (!kycCredItem) {
      setError('No KYC Credential found in your wallet. Please issue a demo KYC credential first.');
      return;
    }

    if (kycCredItem.credential.status === 'REVOKED') {
      setError('Your KYC Credential has been REVOKED by the compliance authority.');
      return;
    }

    const currentTier = kycCredItem.credential.kycTier || kycCredItem.privateData?.kycTier || 1;
    if (currentTier < targetTier) {
      setError(`Your credential is Tier ${currentTier}, but the service requires Tier ${targetTier} or higher.`);
      return;
    }

    try {
      setVerifying(true);
      setError(null);
      setResult(null);

      const res = await apiService.verifySelectiveDisclosure({
        credentialType: 'KYC',
        credentialPayload: {
          credentialId: kycCredItem.credential.credentialId,
          issuerId: kycCredItem.credential.issuerId,
          commitment: kycCredItem.credential.commitment,
          issuedAt: kycCredItem.credential.issuedAt,
          expiresAt: kycCredItem.credential.expiresAt,
        },
        issuerSignature: kycCredItem.credential.issuerSignature,
        disclosedClaims: {
          kycTier: currentTier,
          jurisdiction: kycCredItem.credential.jurisdiction || kycCredItem.privateData?.jurisdiction || 'US',
          complianceStandard: 'AML/FATF-Recommendation-16',
        },
        verifierId: 'verifier:global-fintech-exchange',
        verifierName: 'Apex FinTech Global Exchange',
      });

      setResult(res);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'KYC verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Disclaimer Banner */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-300 text-xs">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Synthetic Demo Identity Notice:</span> ZK-Trust operates strictly with synthetic
          demo data for research and cybersecurity demonstrations. Real passports, national IDs, or confidential
          documents should never be uploaded.
        </div>
      </div>

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900 border border-purple-500/20 p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Feature 3 • Zero-Knowledge KYC</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Privacy-Preserving KYC Verification
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl">
              Satisfy strict Anti-Money Laundering (AML) and Know-Your-Customer regulations by proving your verified
              compliance tier without handing over high-resolution passport scans or personal files.
            </p>
          </div>

          <Link
            to="/issuer?type=KYC"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-all shadow-lg shadow-purple-900/30 shrink-0 self-start md:self-auto"
          >
            <span>Issue KYC Credential</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Current KYC Status */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-5">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-400" />
              <span>Wallet KYC Credential</span>
            </h2>

            {kycCredItem ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-sans">Issuer Provider</span>
                  <span className="text-purple-300 font-semibold text-sm">
                    {kycCredItem.credential.issuerId}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-sans">Verified Tier</span>
                    <span className="text-purple-400 font-bold text-base">
                      Tier {kycCredItem.credential.kycTier || kycCredItem.privateData?.kycTier || 1}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-sans">Jurisdiction</span>
                    <span className="text-slate-200 font-bold">
                      {kycCredItem.credential.jurisdiction || kycCredItem.privateData?.jurisdiction || 'US'}
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                  <span className="text-slate-500 text-[10px] uppercase font-sans">Status</span>
                  <span
                    className={`font-bold ${
                      kycCredItem.credential.status === 'ACTIVE' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {kycCredItem.credential.status}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-slate-950 border border-dashed border-slate-800 text-center space-y-3">
                <FileCheck2 className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">No KYC credential loaded in your digital wallet.</p>
                <Link
                  to="/issuer?type=KYC"
                  className="inline-block text-xs text-purple-400 hover:text-purple-300 font-semibold"
                >
                  Issue verified demo KYC credential &rarr;
                </Link>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/20 text-[11px] text-slate-300 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-purple-400">
                <Lock className="w-3.5 h-3.5" />
                <span>Zero Document Leakage</span>
              </div>
              <p className="text-slate-400">
                The verifier learns only: "User is verified at Tier &ge; {targetTier} by an authorized compliance issuer".
                No identity scans are transmitted.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Service Requirement Simulator */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-6">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Building className="w-5 h-5 text-purple-400" />
              <span>Select Relying Service Compliance Tier</span>
            </h2>

            <div className="space-y-3">
              {tiers.map((t) => (
                <div
                  key={t.tier}
                  onClick={() => setTargetTier(t.tier)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    targetTier === t.tier
                      ? 'bg-purple-500/10 border-purple-500/50 shadow-md shadow-purple-950'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 text-sm">{t.name}</span>
                    <span className="text-xs font-semibold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                      {t.limit}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{t.desc}</p>
                </div>
              ))}
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleVerifyKyc}
              disabled={verifying || !kycCredItem}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-lg shadow-purple-950 flex items-center justify-center gap-2"
            >
              {verifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying KYC Compliance Attestation...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Prove KYC Tier &ge; {targetTier} Compliance</span>
                </>
              )}
            </button>

            {/* Verification Result */}
            {result && (
              <div className="p-5 rounded-2xl bg-purple-950/30 border border-purple-500/40 space-y-4 animate-in fade-in">
                <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                  <CheckCircle className="w-5 h-5 text-purple-400" />
                  <span>KYC Compliance Verified Successfully!</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase font-sans">Issuer</span>
                    <span className="text-purple-300 font-semibold truncate block">{result.issuerName}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase font-sans">Claim</span>
                    <span className="text-purple-400 font-bold truncate block">{result.claim}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase font-sans">Document Leaks</span>
                    <span className="text-emerald-400 font-bold">0 DOCUMENTS</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase font-sans">AML Status</span>
                    <span className="text-emerald-400 font-bold">CLEARED</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
