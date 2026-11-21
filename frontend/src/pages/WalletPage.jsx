import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  KeyRound,
  Trash2,
  FileCheck,
  Clock,
  Fingerprint,
  AlertCircle,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  XCircle,
  GraduationCap,
  FileCheck2,
  UserCheck,
  QrCode,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { apiService } from '../services/api';
import QrCodeSvg from '../components/QrCodeSvg';

export default function WalletPage() {
  const {
    credentials,
    activeCredentialId,
    setActiveCredentialId,
    addCredential,
    removeCredential,
    updateCredentialStatus,
    clearWallet,
  } = useWallet();

  const [filterType, setFilterType] = useState('ALL');
  const [showPrivateDetails, setShowPrivateDetails] = useState(false);
  const [qrModalCred, setQrModalCred] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  // Filtered credentials list
  const filteredCredentials = credentials.filter((item) => {
    if (filterType === 'ALL') return true;
    const type = item.credential.credentialType || 'AGE';
    return type === filterType;
  });

  const activeItem =
    credentials.find((c) => c.credential.credentialId === activeCredentialId) ||
    credentials[0] ||
    null;

  // Check live revocation status for active credential
  const handleCheckStatus = async (credentialId) => {
    try {
      setCheckingStatus(true);
      setStatusMessage(null);
      const res = await apiService.getRevocationStatus(credentialId);
      updateCredentialStatus(credentialId, res.status, res.revocationDetails);
      setStatusMessage(`Status: ${res.status} ${res.isRevoked ? `(Reason: ${res.revocationDetails?.reason})` : ''}`);
    } catch (err) {
      setStatusMessage(`Status check failed: ${err.message}`);
    } finally {
      setCheckingStatus(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border border-cyan-500/20 p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Multi-Credential Sovereign Wallet</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Digital Identity Wallet
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl">
              Your self-sovereign digital identity vault. All private attributes and secrets are kept strictly in local
              browser memory. You selectively generate cryptographic proofs on demand.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
            <Link
              to="/issuer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition-all shadow-lg shadow-cyan-950"
            >
              <Sparkles className="w-4 h-4" />
              <span>Mint New Credential</span>
            </Link>
            {credentials.length > 0 && (
              <button
                onClick={clearWallet}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700 transition-colors"
                title="Clear all credentials"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between text-cyan-300 text-xs">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        {[
          { id: 'ALL', label: `All Credentials (${credentials.length})` },
          { id: 'STUDENT', label: 'Student IDs' },
          { id: 'AGE', label: 'Age & Citizen' },
          { id: 'KYC', label: 'KYC Proofs' },
          { id: 'HUMAN', label: 'Proof of Human' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterType(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              filterType === tab.id
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 bg-slate-950/60 border border-slate-800/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Credentials List & Details Grid */}
      {filteredCredentials.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900/60 border border-dashed border-slate-800 text-center space-y-4">
          <Fingerprint className="w-12 h-12 text-slate-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-300">No credentials found</h3>
            <p className="text-xs text-slate-500">
              {filterType === 'ALL'
                ? 'Your wallet is currently empty. Visit the Issuer Portal to mint your first credential.'
                : `No credentials matching filter "${filterType}".`}
            </p>
          </div>
          <Link
            to="/issuer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs"
          >
            <span>Mint Credentials</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Credentials Selector Cards */}
          <div className="lg:col-span-1 space-y-3">
            {filteredCredentials.map((item) => {
              const cred = item.credential;
              const type = cred.credentialType || 'AGE';
              const isSelected = cred.credentialId === (activeItem?.credential?.credentialId);
              const isRevoked = cred.status === 'REVOKED';

              return (
                <div
                  key={cred.credentialId}
                  onClick={() => setActiveCredentialId(cred.credentialId)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-cyan-500/10 border-cyan-500/50 shadow-lg shadow-cyan-950'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-cyan-400 border border-slate-700">
                      {type}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isRevoked
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {cred.status}
                    </span>
                  </div>

                  <div className="text-xs font-bold text-slate-200">
                    {type === 'STUDENT'
                      ? cred.collegeName || item.privateData?.collegeName || 'Student ID'
                      : type === 'KYC'
                      ? `KYC Tier ${cred.kycTier || item.privateData?.kycTier || 1}`
                      : type === 'HUMAN'
                      ? `Verified Human (${cred.livenessScore || 98}%)`
                      : `Civil ID (Age ${item.privateData?.age || '21'})`}
                  </div>

                  <div className="text-[10px] text-slate-500 font-mono mt-1 truncate">
                    ID: {cred.credentialId}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Active Credential Deep Inspector */}
          {activeItem && (
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-white">
                        {activeItem.credential.credentialType || 'AGE'} Credential
                      </h2>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          activeItem.credential.status === 'REVOKED'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {activeItem.credential.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      {activeItem.credential.credentialId}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCheckStatus(activeItem.credential.credentialId)}
                      disabled={checkingStatus}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-spin' : ''}`} />
                      <span>Check Revocation</span>
                    </button>
                    <button
                      onClick={() => setQrModalCred(activeItem.credential)}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Export QR</span>
                    </button>
                  </div>
                </div>

                {/* Public On-Chain & Issuer Metadata */}
                <div className="space-y-3 font-mono text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-slate-500 text-[10px] uppercase font-sans block">Issuer Authority</span>
                      <span className="text-slate-200 truncate block">{activeItem.credential.issuerId}</span>
                    </div>
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-slate-500 text-[10px] uppercase font-sans block">Issued Timestamp</span>
                      <span className="text-slate-200 block">
                        {new Date(activeItem.credential.issuedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="flex justify-between items-center text-slate-500 text-[10px] uppercase font-sans mb-1">
                      <span>Cryptographic Poseidon Commitment</span>
                      <button
                        onClick={() => copyToClipboard(activeItem.credential.commitment, 'comm')}
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        {copiedKey === 'comm' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <span className="text-cyan-300 break-all">{activeItem.credential.commitment}</span>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="flex justify-between items-center text-slate-500 text-[10px] uppercase font-sans mb-1">
                      <span>Issuer Ed25519 Signature</span>
                      <button
                        onClick={() => copyToClipboard(activeItem.credential.issuerSignature, 'sig')}
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        {copiedKey === 'sig' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <span className="text-slate-400 break-all">{activeItem.credential.issuerSignature}</span>
                  </div>
                </div>

                {/* Private Witness Inspector */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-slate-200">Private Witness Vault</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        CLIENT ONLY
                      </span>
                    </div>
                    <button
                      onClick={() => setShowPrivateDetails(!showPrivateDetails)}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      {showPrivateDetails ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showPrivateDetails ? 'Hide Private Secrets' : 'Reveal Witness Secrets'}</span>
                    </button>
                  </div>

                  {showPrivateDetails ? (
                    <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 font-mono text-xs space-y-2 text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Full Name:</span>
                        <span className="text-amber-200 font-bold">{activeItem.privateData?.fullName}</span>
                      </div>
                      {activeItem.privateData?.age && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Genuine Age:</span>
                          <span className="text-amber-200 font-bold">{activeItem.privateData.age} years</span>
                        </div>
                      )}
                      {activeItem.privateData?.dateOfBirth && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Date of Birth:</span>
                          <span className="text-amber-200 font-bold">{activeItem.privateData.dateOfBirth}</span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-slate-800">
                        <span className="text-slate-500 text-[10px] block">BN254 Field Secret Salt:</span>
                        <span className="text-amber-300 break-all">{activeItem.privateData?.secret}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      Private witness values are protected. Click "Reveal" above to inspect the salt and secret.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* QR Code Export Modal */}
      {qrModalCred && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 rounded-2xl border border-cyan-500/30 p-6 space-y-5 text-center shadow-2xl">
            <h3 className="font-bold text-white text-base">Export Credential QR</h3>
            <p className="text-xs text-slate-400 font-mono truncate">{qrModalCred.credentialId}</p>

            <div className="flex justify-center">
              <QrCodeSvg value={JSON.stringify(qrModalCred)} size={220} />
            </div>

            <p className="text-[11px] text-slate-500">
              Only public commitment and cryptographic signature are contained in this QR code.
            </p>

            <button
              onClick={() => setQrModalCred(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
