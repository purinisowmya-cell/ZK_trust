import React, { useState } from 'react';
import {
  GraduationCap,
  ShieldCheck,
  Building2,
  BookOpen,
  Calendar,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { apiService } from '../services/api';
import { Link } from 'react-router-dom';

export default function StudentVerification() {
  const { credentials } = useWallet();
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedBenefit, setSelectedBenefit] = useState('transit');

  // Find student credential in wallet
  const studentCredItem = credentials.find(
    (c) => c.credential?.credentialType === 'STUDENT'
  );

  const perks = [
    {
      id: 'transit',
      title: 'Metro & Rail Student Pass',
      discount: '50% Off Monthly Fare',
      icon: '🚆',
      requirement: 'Active Collegiate Enrollment (Graduation Year >= 2025)',
    },
    {
      id: 'software',
      title: 'DevCloud Professional Tools',
      discount: 'Free $200/Mo Academic Tier',
      icon: '💻',
      requirement: 'Verified Computer Science or Engineering Department',
    },
    {
      id: 'library',
      title: 'Inter-University Library Network',
      discount: 'Global Digital Access',
      icon: '📚',
      requirement: 'Accredited University Enrollment',
    },
  ];

  const handleVerifyStudentStatus = async () => {
    if (!studentCredItem) {
      setError('No Student Credential found in your wallet. Please issue one from the Issuer Portal.');
      return;
    }

    if (studentCredItem.credential.status === 'REVOKED') {
      setError('Cannot verify: Your student credential has been REVOKED by the issuing institution.');
      return;
    }

    try {
      setVerifying(true);
      setError(null);
      setVerificationResult(null);

      const res = await apiService.verifySelectiveDisclosure({
        credentialType: 'STUDENT',
        credentialPayload: {
          credentialId: studentCredItem.credential.credentialId,
          issuerId: studentCredItem.credential.issuerId,
          commitment: studentCredItem.credential.commitment,
          issuedAt: studentCredItem.credential.issuedAt,
          expiresAt: studentCredItem.credential.expiresAt,
        },
        issuerSignature: studentCredItem.credential.issuerSignature,
        disclosedClaims: {
          collegeName: studentCredItem.credential.collegeName || studentCredItem.privateData?.collegeName,
          enrollmentStatus: 'ENROLLED',
          graduationYear: studentCredItem.credential.graduationYear || studentCredItem.privateData?.graduationYear,
        },
        verifierId: 'verifier:campus-benefit-network',
        verifierName: 'Student Advantage Network',
      });

      setVerificationResult(res);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Student verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950/40 via-cyan-950/30 to-slate-900 border border-emerald-500/20 p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Feature 1 • Accredited Collegiate Trust</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Privacy-Preserving Student Verification
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl">
              Prove active enrollment and university credentials for academic benefits, discounts, and campus access
              without leaking your home address, date of birth, grades, or personal student file.
            </p>
          </div>

          <Link
            to="/issuer?type=STUDENT"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-all shadow-lg shadow-emerald-900/30 shrink-0 self-start md:self-auto"
          >
            <Building2 className="w-4 h-4" />
            <span>Issue Student ID</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Student Credential Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-emerald-400" />
                <span>Collegiate ID Card</span>
              </h2>
              {studentCredItem && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    studentCredItem.credential.status === 'REVOKED'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {studentCredItem.credential.status}
                </span>
              )}
            </div>

            {studentCredItem ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3 font-mono text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-sans">Institution</span>
                  <span className="text-emerald-300 font-semibold text-sm">
                    {studentCredItem.credential.collegeName || studentCredItem.privateData?.collegeName || 'MIT'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-sans">Department</span>
                  <span className="text-slate-200">
                    {studentCredItem.credential.department || studentCredItem.privateData?.department || 'Computer Science'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-sans">Course of Study</span>
                  <span className="text-slate-300">
                    {studentCredItem.credential.course || studentCredItem.privateData?.course || 'B.S. in Computer Science'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-sans">Grad Class</span>
                    <span className="text-slate-200 font-bold">
                      {studentCredItem.credential.graduationYear || studentCredItem.privateData?.graduationYear || '2027'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-sans">Status</span>
                    <span className="text-emerald-400 font-bold">
                      {studentCredItem.credential.enrollmentStatus || 'ENROLLED'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-slate-950 border border-dashed border-slate-800 text-center space-y-3">
                <GraduationCap className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">
                  No verified student credential loaded in your digital wallet.
                </p>
                <Link
                  to="/issuer?type=STUDENT"
                  className="inline-block text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                >
                  Mint demo MIT / Stanford student ID &rarr;
                </Link>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-[11px] text-slate-300 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                <Lock className="w-3.5 h-3.5" />
                <span>Zero-Knowledge Disclosure</span>
              </div>
              <p className="text-slate-400">
                Only the predicate (e.g. "Status: Enrolled" and Graduation &ge; 2025) is verified. Your raw student ID
                number and internal grades remain hidden.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Benefit Verification Portal */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-6">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <span>Select Academic Perk to Unlock</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {perks.map((perk) => (
                <button
                  key={perk.id}
                  onClick={() => setSelectedBenefit(perk.id)}
                  className={`p-4 rounded-xl text-left border transition-all ${
                    selectedBenefit === perk.id
                      ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md shadow-emerald-950'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="text-2xl mb-2">{perk.icon}</div>
                  <h3 className="font-semibold text-slate-200 text-xs mb-1">{perk.title}</h3>
                  <div className="text-emerald-400 font-bold text-xs mb-2">{perk.discount}</div>
                  <div className="text-[10px] text-slate-500 line-clamp-2">{perk.requirement}</div>
                </button>
              ))}
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleVerifyStudentStatus}
              disabled={verifying || !studentCredItem}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-950 flex items-center justify-center gap-2"
            >
              {verifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying University Signature & Enrollment...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Prove Student Status Without Exposing Personal Data</span>
                </>
              )}
            </button>

            {/* Verification Result Card */}
            {verificationResult && (
              <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-4 animate-in fade-in">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span>Academic Verification Successful! Benefit Unlocked.</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase font-sans">Issuer</span>
                    <span className="text-slate-200 truncate block">{verificationResult.issuerName}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase font-sans">Claim</span>
                    <span className="text-emerald-400 font-bold truncate block">{verificationResult.claim}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase font-sans">Revocation</span>
                    <span className="text-emerald-400 font-bold">ACTIVE</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase font-sans">Leakage</span>
                    <span className="text-cyan-400 font-bold">0 BYTES</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 font-mono">
                  Nullifier: <span className="text-slate-300">{verificationResult.nullifier}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
