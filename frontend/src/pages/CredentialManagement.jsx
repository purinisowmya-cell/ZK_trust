import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Ban,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  FileText,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { apiService } from '../services/api';
import { useWallet } from '../context/WalletContext';

export default function CredentialManagement() {
  const { updateCredentialStatus } = useWallet();
  const [credentials, setCredentials] = useState([]);
  const [revocations, setRevocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Revocation Modal State
  const [selectedCred, setSelectedCred] = useState(null);
  const [revocationReason, setRevocationReason] = useState('Academic degree conferred / credential superceded');
  const [revoking, setRevoking] = useState(false);

  const fetchCredentials = async () => {
    try {
      setLoading(true);
      setError(null);
      const credData = await apiService.listIssuerCredentials();
      const revData = await apiService.listRevocations();
      setCredentials(credData.credentials || []);
      setRevocations(revData.revocations || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch credentials.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  const handleRevoke = async () => {
    if (!selectedCred || !revocationReason) return;

    try {
      setRevoking(true);
      setError(null);
      setSuccess(null);

      const res = await apiService.revokeCredential({
        credentialId: selectedCred.credential_id,
        issuerId: selectedCred.issuer_id,
        reason: revocationReason,
      });

      setSuccess(`Credential ${selectedCred.credential_id} successfully revoked.`);
      updateCredentialStatus(selectedCred.credential_id, 'REVOKED', res.revocation);
      setSelectedCred(null);
      await fetchCredentials();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Revocation failed.');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-950/40 via-red-950/30 to-slate-900 border border-rose-500/20 p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Feature 6 • Cryptographic Revocation Registry</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Credential Lifecycle & Revocation Hub
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl">
              Inspect all issued credentials and maintain public transparency. Authorized issuers can immediately revoke
              compromised, expired, or superseded credentials to block any future zero-knowledge verification attempts.
            </p>
          </div>

          <button
            onClick={fetchCredentials}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-all border border-slate-700 shrink-0 self-start md:self-auto"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Registry</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3 text-emerald-300 text-xs">
          <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Registry Table */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-800/80 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <FileText className="w-5 h-5 text-rose-400" />
            <span>Issued Credentials Registry ({credentials.length})</span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/80 text-slate-400 font-sans border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Credential ID</th>
                <th className="py-3.5 px-4 font-semibold">Type</th>
                <th className="py-3.5 px-4 font-semibold">Issuer Authority</th>
                <th className="py-3.5 px-4 font-semibold">Issued Date</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {credentials.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                    {loading ? 'Loading credentials...' : 'No credentials issued yet.'}
                  </td>
                </tr>
              ) : (
                credentials.map((cred) => {
                  const isRevoked = cred.status === 'REVOKED' || !!cred.revocation_reason;
                  return (
                    <tr key={cred.credential_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-200">
                        {cred.credential_id.slice(0, 16)}...
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[10px] font-bold">
                          {cred.credential_type || 'AGE'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-400 truncate max-w-xs">
                        {cred.issuer_name || cred.issuer_id}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-sans">
                        {new Date(cred.issued_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        {isRevoked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            REVOKED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            ACTIVE
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isRevoked ? (
                          <span className="text-[11px] text-slate-500 italic font-sans" title={cred.revocation_reason}>
                            Revoked
                          </span>
                        ) : (
                          <button
                            onClick={() => setSelectedCred(cred)}
                            className="px-3 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold font-sans transition-all"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revocation Modal */}
      {selectedCred && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-rose-500/30 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                <Ban className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Revoke Credential</h3>
                <p className="text-slate-400 text-xs font-mono">{selectedCred.credential_id.slice(0, 20)}...</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-300 font-semibold block">Official Reason for Revocation:</label>
              <textarea
                rows={3}
                value={revocationReason}
                onChange={(e) => setRevocationReason(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                placeholder="Enter specific audit reason..."
              />
            </div>

            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300">
              Warning: Once revoked, the credential commitment is invalidated in the verification registry. Any proof
              presented using this credential will be rejected immediately.
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedCred(null)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md"
              >
                {revoking ? 'Revoking...' : 'Confirm Revocation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
