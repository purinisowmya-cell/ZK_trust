import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Landmark,
  KeyRound,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { apiService } from '../services/api';

export default function IssuerPortal() {
  const navigate = useNavigate();
  const { saveWalletCredential } = useWallet();

  const [issuerProfile, setIssuerProfile] = useState(null);
  const [fullName, setFullName] = useState('Alex Vance');
  const [dateOfBirth, setDateOfBirth] = useState('2005-05-14');
  const [age, setAge] = useState(21);
  const [secret, setSecret] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [issuedResult, setIssuedResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    const fetchIssuer = async () => {
      try {
        const profile = await apiService.getIssuerProfile();
        setIssuerProfile(profile);
      } catch (err) {
        console.warn('Could not fetch issuer profile:', err.message);
      }
    };
    fetchIssuer();
  }, []);

  // Update age when DOB changes
  const handleDobChange = (e) => {
    const val = e.target.value;
    setDateOfBirth(val);
    if (val) {
      const birth = new Date(val);
      if (!isNaN(birth.getTime())) {
        const diff = Date.now() - birth.getTime();
        const calculatedAge = Math.abs(new Date(diff).getUTCFullYear() - 1970);
        setAge(calculatedAge);
      }
    }
  };

  // Presets
  const applyPreset = (name, dob, presetAge) => {
    setFullName(name);
    setDateOfBirth(dob);
    setAge(presetAge);
    setSecret('');
    setIssuedResult(null);
  };

  const handleIssueCredential = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setIssuedResult(null);

    try {
      const result = await apiService.issueCredential({
        fullName,
        dateOfBirth,
        age: parseInt(age, 10),
        secret: secret || undefined,
      });

      setIssuedResult(result);
      // Automatically save to local demo wallet
      saveWalletCredential(result.credential, result.privateData);
    } catch (err) {
      setErrorMessage(err.response?.data?.error || err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyKey = () => {
    if (issuerProfile?.publicKey) {
      navigator.clipboard.writeText(issuerProfile.publicKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      
      {/* Header */}
      <div className="pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Landmark className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Official Identity Issuer Portal
            </h1>
            <p className="text-sm text-slate-400">
              Authority node for minting synthetic digital identity credentials with Ed25519 digital signatures.
            </p>
          </div>
        </div>
      </div>

      {/* Issuer Profile Card */}
      {issuerProfile && (
        <div className="cyber-card p-5 bg-[#0c1322] border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Trusted Authority:</span>
              <strong className="text-sm text-slate-200">{issuerProfile.name}</strong>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                ACTIVE
              </span>
            </div>
            <div className="text-xs font-mono text-cyan-400/80">
              DID: {issuerProfile.issuerId}
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyKey}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-[#141e34] border border-slate-700 rounded-lg transition-colors self-start sm:self-center"
          >
            {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedKey ? 'Key Copied!' : 'Copy Ed25519 Public Key'}</span>
          </button>
        </div>
      )}

      {/* Error alert */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* Preset Pickers */}
      <div className="cyber-card p-6 border-slate-800">
        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>Quick Synthetic Persona Presets:</span>
        </h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => applyPreset('Alex Vance', '2005-05-14', 21)}
            className="p-3 text-left rounded-lg bg-[#141e34] hover:bg-[#1e2c4a] border border-slate-700 transition-colors"
          >
            <div className="font-semibold text-white text-xs">Adult (Age 21)</div>
            <div className="text-[11px] text-slate-400">DOB: 2005-05-14 • Alex Vance</div>
          </button>

          <button
            type="button"
            onClick={() => applyPreset('Alice Minor', '2009-08-20', 17)}
            className="p-3 text-left rounded-lg bg-[#141e34] hover:bg-[#1e2c4a] border border-slate-700 transition-colors"
          >
            <div className="font-semibold text-rose-300 text-xs">Minor (Age 17)</div>
            <div className="text-[11px] text-slate-400">DOB: 2009-08-20 • Alice Minor</div>
          </button>

          <button
            type="button"
            onClick={() => applyPreset('Marcus Miller', '2000-02-10', 26)}
            className="p-3 text-left rounded-lg bg-[#141e34] hover:bg-[#1e2c4a] border border-slate-700 transition-colors"
          >
            <div className="font-semibold text-white text-xs">Adult (Age 26)</div>
            <div className="text-[11px] text-slate-400">DOB: 2000-02-10 • Marcus Miller</div>
          </button>
        </div>
      </div>

      {/* Issuance Form */}
      <form onSubmit={handleIssueCredential} className="cyber-card p-6 border-cyan-500/30 space-y-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-cyan-400" />
          <span>Synthetic Credential Generation</span>
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Full Name (Demo):
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="cyber-input text-sm"
              placeholder="e.g. John Doe"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Date of Birth:
            </label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={handleDobChange}
              required
              className="cyber-input text-sm"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Calculated Age in Years:
            </label>
            <input
              type="number"
              min="0"
              max="150"
              value={age}
              onChange={(e) => setAge(parseInt(e.target.value, 10))}
              required
              className="cyber-input text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Custom Secret Salt (Optional):
            </label>
            <input
              type="text"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="cyber-input text-sm font-mono text-xs"
              placeholder="Leave empty for auto-generated 248-bit secret"
            />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#141e34]/70 border border-slate-700/60 text-xs space-y-1.5 text-slate-300">
          <div className="font-semibold text-cyan-400">Cryptographic Operation on Issuance:</div>
          <div>1. Compute BN254 Poseidon commitment: <code className="text-cyan-300 font-mono">Poseidon(age, secret)</code></div>
          <div>2. Sign canonical payload with Issuer's Ed25519 private key</div>
          <div>3. Deliver credential directly into user's wallet without storing secret or age on server</div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="cyber-btn-primary w-full py-3 text-sm font-bold"
        >
          {isSubmitting ? (
            <>
              <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              <span>Minting Signed Credential...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-5 h-5" />
              <span>Sign & Mint Identity Credential</span>
            </>
          )}
        </button>
      </form>

      {/* Success Result View */}
      {issuedResult && (
        <div className="cyber-card p-6 border-emerald-500/50 bg-emerald-950/20 space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between pb-3 border-b border-emerald-500/30">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <ShieldCheck className="w-6 h-6" />
              <span>Credential Successfully Minted & Transferred to Wallet</span>
            </div>
            <button
              onClick={() => navigate('/wallet')}
              className="cyber-btn-primary text-xs px-3 py-1.5"
            >
              <span>View in Wallet</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 font-mono text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5">Credential ID:</span>
              <div className="p-2 bg-black/60 rounded border border-slate-800 text-slate-300 break-all select-all">
                {issuedResult.credential.credentialId}
              </div>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">Poseidon Commitment Hash:</span>
              <div className="p-2 bg-black/60 rounded border border-emerald-500/30 text-emerald-300 break-all select-all font-bold">
                {issuedResult.credential.commitment}
              </div>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5">Ed25519 Issuer Digital Signature:</span>
              <div className="p-2 bg-black/60 rounded border border-slate-800 text-slate-400 break-all select-all text-[11px]">
                {issuedResult.credential.issuerSignature}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
