import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Landmark,
  KeyRound,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Copy,
  Check,
  GraduationCap,
  FileCheck,
  UserCheck,
  Calendar,
  Building,
  CheckCircle,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { apiService } from '../services/api';

export default function IssuerPortal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addCredential } = useWallet();

  const [issuers, setIssuers] = useState([]);
  const [selectedIssuerId, setSelectedIssuerId] = useState('did:zktrust:issuer:gov-demo-1');
  const [activeTab, setActiveTab] = useState(searchParams.get('type') || 'STUDENT'); // 'STUDENT' | 'AGE' | 'KYC' | 'HUMAN'

  // Student Form
  const [studentId, setStudentId] = useState('STU-2027-0941');
  const [studentName, setStudentName] = useState('Alex Vance');
  const [collegeName, setCollegeName] = useState('Massachusetts Institute of Technology');
  const [department, setDepartment] = useState('Computer Science & AI');
  const [course, setCourse] = useState('B.S. in Computer Science');
  const [graduationYear, setGraduationYear] = useState(2027);
  const [enrollmentStatus, setEnrollmentStatus] = useState('ENROLLED');

  // Age Form
  const [fullName, setFullName] = useState('Alex Vance');
  const [dateOfBirth, setDateOfBirth] = useState('2005-05-14');
  const [age, setAge] = useState(21);

  // KYC Form
  const [kycName, setKycName] = useState('Alex Vance');
  const [kycTier, setKycTier] = useState(2);
  const [jurisdiction, setJurisdiction] = useState('US');
  const [idType, setIdType] = useState('PASSPORT');

  // Human Form
  const [humanName, setHumanName] = useState('Alex Vance');
  const [livenessScore, setLivenessScore] = useState(98.8);
  const [sybilResistance, setSybilResistance] = useState('HIGH');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [issuedResult, setIssuedResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    const fetchIssuers = async () => {
      try {
        const res = await apiService.getIssuers();
        setIssuers(res.issuers || []);
        if (searchParams.get('type') === 'STUDENT') {
          setSelectedIssuerId('did:zktrust:issuer:mit-edu');
          setActiveTab('STUDENT');
        } else if (searchParams.get('type') === 'KYC') {
          setSelectedIssuerId('did:zktrust:issuer:trust-kyc');
          setActiveTab('KYC');
        }
      } catch (err) {
        console.warn('Could not fetch issuers:', err);
      }
    };
    fetchIssuers();
  }, [searchParams]);

  const selectedIssuer = issuers.find((i) => i.issuer_id === selectedIssuerId) || issuers[0];

  const handleIssue = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setIssuedResult(null);

      let res = null;

      if (activeTab === 'STUDENT') {
        res = await apiService.issueStudentCredential({
          studentId,
          fullName: studentName,
          collegeName,
          department,
          course,
          graduationYear,
          enrollmentStatus,
          issuerId: selectedIssuerId,
        });
      } else if (activeTab === 'AGE') {
        res = await apiService.issueCredential({
          fullName,
          age,
          dateOfBirth,
          issuerId: selectedIssuerId,
        });
      } else if (activeTab === 'KYC') {
        res = await apiService.issueKycCredential({
          fullName: kycName,
          kycTier,
          jurisdiction,
          idType,
          issuerId: selectedIssuerId,
        });
      } else if (activeTab === 'HUMAN') {
        res = await apiService.issueHumanCredential({
          fullName: humanName,
          livenessScore,
          sybilResistanceLevel: sybilResistance,
          issuerId: selectedIssuerId,
        });
      }

      setIssuedResult(res);
      addCredential(res.credential, res.privateData);
    } catch (err) {
      setErrorMessage(err.response?.data?.error || err.message || 'Issuance failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyPublicKey = () => {
    if (selectedIssuer?.public_key) {
      navigator.clipboard?.writeText(selectedIssuer.public_key);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-900 border border-blue-500/20 p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
              <Landmark className="w-3.5 h-3.5" />
              <span>Feature 5 • Multi-Issuer Credential Mint</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Accredited Issuer Authority Portal
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl">
              Universities, colleges, KYC providers, and civil authorities issue tamper-proof cryptographic credentials
              signed with Ed25519 private keys. Only public commitments are recorded; private witness secrets are
              transferred securely to the user's wallet.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Authority Profile & Public Key */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-5">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Building className="w-5 h-5 text-blue-400" />
              <span>Select Issuing Authority</span>
            </h2>

            <div className="space-y-2">
              {issuers.map((iss) => (
                <div
                  key={iss.issuer_id}
                  onClick={() => setSelectedIssuerId(iss.issuer_id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedIssuerId === iss.issuer_id
                      ? 'bg-blue-500/15 border-blue-500/60 shadow-md shadow-blue-950 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs text-slate-200">{iss.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-800 text-slate-300">
                      {iss.issuer_type}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold">Active</span>
                  </div>
                </div>
              ))}
            </div>

            {selectedIssuer && (
              <div className="space-y-3 pt-3 border-t border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold block">On-Chain Address</span>
                  <span className="font-mono text-[11px] text-indigo-300 truncate block">
                    {selectedIssuer.onchain_address}
                  </span>
                </div>
                <div>
                  <div className="flex justify-between items-center text-slate-500 text-[10px] uppercase font-semibold mb-1">
                    <span>Ed25519 Public Key</span>
                    <button
                      onClick={copyPublicKey}
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-sans"
                    >
                      {copiedKey ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[9px] font-mono text-slate-400 overflow-x-auto max-h-24">
                    {selectedIssuer.public_key}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Issuance Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-6">
            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-4 overflow-x-auto">
              {[
                { id: 'STUDENT', label: 'Student Credential', icon: GraduationCap },
                { id: 'AGE', label: 'Age / Citizen ID', icon: Calendar },
                { id: 'KYC', label: 'Privacy KYC', icon: FileCheck },
                { id: 'HUMAN', label: 'Proof of Human', icon: UserCheck },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200 bg-slate-950/60 border border-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB: STUDENT */}
            {activeTab === 'STUDENT' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">Student Full Name</label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">Student ID Number</label>
                  <input
                    type="text"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">Collegiate Institution</label>
                  <input
                    type="text"
                    value={collegeName}
                    onChange={(e) => setCollegeName(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">Academic Department</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">Degree Program / Course</label>
                  <input
                    type="text"
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">Expected Graduation Year</label>
                  <input
                    type="number"
                    value={graduationYear}
                    onChange={(e) => setGraduationYear(parseInt(e.target.value, 10))}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
              </div>
            )}

            {/* TAB: AGE */}
            {activeTab === 'AGE' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">Citizen Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">Date of Birth</label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => {
                      setDateOfBirth(e.target.value);
                      if (e.target.value) {
                        const birth = new Date(e.target.value);
                        const diff = Date.now() - birth.getTime();
                        setAge(Math.abs(new Date(diff).getUTCFullYear() - 1970));
                      }
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs text-slate-400 font-medium">Calculated Age: {age} years</label>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                    Calculated age will be salted with a 248-bit secret and hashed via Poseidon.
                  </div>
                </div>
              </div>
            )}

            {/* TAB: KYC */}
            {activeTab === 'KYC' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">Full Legal Name</label>
                  <input
                    type="text"
                    value={kycName}
                    onChange={(e) => setKycName(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">Compliance Verification Tier</label>
                  <select
                    value={kycTier}
                    onChange={(e) => setKycTier(parseInt(e.target.value, 10))}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  >
                    <option value={1}>Tier 1: Basic ID & Nationality</option>
                    <option value={2}>Tier 2: Enhanced AML & Sanctions Check</option>
                    <option value={3}>Tier 3: Institutional Biometric Audit</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">Jurisdiction</label>
                  <input
                    type="text"
                    value={jurisdiction}
                    onChange={(e) => setJurisdiction(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">Identity Document Type</label>
                  <select
                    value={idType}
                    onChange={(e) => setIdType(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  >
                    <option value="PASSPORT">Passport</option>
                    <option value="NATIONAL_ID">National ID Card</option>
                    <option value="DRIVERS_LICENSE">Driver's License</option>
                  </select>
                </div>
              </div>
            )}

            {/* TAB: HUMAN */}
            {activeTab === 'HUMAN' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">Human User Name</label>
                  <input
                    type="text"
                    value={humanName}
                    onChange={(e) => setHumanName(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">Liveness Score (%): {livenessScore}%</label>
                  <input
                    type="range"
                    min="80"
                    max="100"
                    step="0.1"
                    value={livenessScore}
                    onChange={(e) => setLivenessScore(parseFloat(e.target.value))}
                    className="w-full accent-blue-400"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs text-slate-400 font-medium">Sybil Resistance Level</label>
                  <select
                    value={sybilResistance}
                    onChange={(e) => setSybilResistance(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  >
                    <option value="HIGH">HIGH (Multi-Modal Liveness & Biometric Uniqueness)</option>
                    <option value="MEDIUM">MEDIUM (Standard Proof of Liveness)</option>
                  </select>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              onClick={handleIssue}
              disabled={isSubmitting}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-lg shadow-blue-950 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Computing Poseidon Commitment & Ed25519 Signature...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Mint {activeTab} Credential & Save to Wallet</span>
                </>
              )}
            </button>

            {/* Issued Result Display */}
            {issuedResult && (
              <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    <span>Credential Successfully Minted and Saved to Wallet!</span>
                  </div>
                  <button
                    onClick={() => navigate('/wallet')}
                    className="text-xs text-emerald-300 hover:text-white font-bold flex items-center gap-1"
                  >
                    <span>View in Wallet</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-slate-500 text-[10px] block font-sans uppercase">Credential ID</span>
                    <span className="text-slate-200">{issuedResult.credential.credentialId}</span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-slate-500 text-[10px] block font-sans uppercase">Poseidon Commitment</span>
                    <span className="text-emerald-400 truncate block">{issuedResult.credential.commitment}</span>
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
