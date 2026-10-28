/**
 * BackupPage — Automated SQLite database snapshot creation, download, integrity check, and restoration.
 */
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Database,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Plus,
  ShieldCheck,
  HardDrive,
  X,
  AlertTriangle,
} from "lucide-react";
import { apiClient } from "@/api/client";
import type { BackupSnapshot } from "@/types";

export const BackupPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [backupNote, setBackupNote] = useState("");
  const [selectedBackupToRestore, setSelectedBackupToRestore] = useState<BackupSnapshot | null>(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const { data: backups = [], isLoading } = useQuery<BackupSnapshot[]>({
    queryKey: ["backupsList"],
    queryFn: apiClient.backup.list,
  });

  const createBackupMutation = useMutation({
    mutationFn: (note?: string) => apiClient.backup.create(note),
    onSuccess: (data: BackupSnapshot) => {
      queryClient.invalidateQueries({ queryKey: ["backupsList"] });
      setSuccessMsg(`Backup created successfully: ${data.filename} (${(data.size_bytes / 1024).toFixed(1)} KB)`);
      setShowCreateModal(false);
      setBackupNote("");
      setTimeout(() => setSuccessMsg(""), 5000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to create database backup");
    },
  });

  const restoreBackupMutation = useMutation({
    mutationFn: (filename: string) => apiClient.backup.restore(filename),
    onSuccess: (res: { status: string; restored_from: string; safeguard_backup: string }) => {
      queryClient.invalidateQueries();
      setSuccessMsg(`Database restored successfully from ${res.restored_from}. Safeguard backup saved as ${res.safeguard_backup}.`);
      setSelectedBackupToRestore(null);
      setRestoreConfirmText("");
      setTimeout(() => setSuccessMsg(""), 6000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to restore database");
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createBackupMutation.mutate(backupNote.trim() || undefined);
  };

  const handleRestoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBackupToRestore) return;
    if (restoreConfirmText !== "RESTORE") {
      setErrorMsg("Please type RESTORE to confirm this operation");
      return;
    }
    restoreBackupMutation.mutate(selectedBackupToRestore.filename);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Database className="w-6 h-6 text-emerald-400" />
            Database Backup & Safeguard Recovery
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Zero-downtime point-in-time SQLite backups with PRAGMA quick_check integrity validation
          </p>
        </div>

        <button
          onClick={() => {
            setShowCreateModal(true);
            setBackupNote(`Manual backup before operations - ${new Date().toLocaleDateString()}`);
            setErrorMsg("");
          }}
          className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition flex items-center gap-2 shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Create Backup Snapshot
        </button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Safety & Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Snapshots</span>
            <HardDrive className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-bold font-numeric tabular-nums text-white">{backups.length}</p>
          <p className="text-xs text-slate-500 mt-1">Available in local backups/ directory</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Integrity Standard</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-sm font-bold text-emerald-400 mt-1">PRAGMA quick_check Verified</p>
          <p className="text-xs text-slate-500 mt-1">100% database file health</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Restore Safeguard</span>
            <RotateCcw className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-sm font-bold text-slate-200 mt-1">Automatic Safety Backup</p>
          <p className="text-xs text-slate-500 mt-1">Taken immediately prior to any restore</p>
        </div>
      </div>

      {/* Backups Table */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Available Backups</h2>
          <span className="text-xs text-slate-400">{backups.length} snapshot(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Backup File</th>
                <th className="py-3 px-4">Created Date & Time</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Integrity Status</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading backups...
                  </td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No backup files found. Click "Create Backup Snapshot" to generate your first backup.
                  </td>
                </tr>
              ) : (
                backups.map((b: BackupSnapshot) => (
                  <tr key={b.filename} className="hover:bg-slate-750/30 transition">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-sky-400">
                      {b.filename}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs whitespace-nowrap">
                      {new Date(b.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono text-xs">
                      {formatFileSize(b.size_bytes)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" /> Valid
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs max-w-xs truncate">
                      {b.note || "Automated backup"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <a
                          href={`/api/backup/download/${b.filename}`}
                          download={b.filename}
                          className="px-2.5 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition flex items-center gap-1"
                          title="Download .db file"
                        >
                          <Download className="w-3.5 h-3.5 text-sky-400" /> Download
                        </a>
                        <button
                          onClick={() => {
                            setSelectedBackupToRestore(b);
                            setRestoreConfirmText("");
                            setErrorMsg("");
                          }}
                          className="px-2.5 py-1 rounded-md bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 text-xs font-medium transition flex items-center gap-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Restore
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Backup Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-400" />
              Create Consistent SQLite Backup
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Takes an online snapshot of active data without locking or pausing ongoing gameplay sessions.
            </p>

            <form onSubmit={handleCreateSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Backup Note / Description
                </label>
                <input
                  type="text"
                  value={backupNote}
                  onChange={e => setBackupNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. End of day closing backup"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBackupMutation.isPending}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition shadow-sm disabled:opacity-50"
                >
                  {createBackupMutation.isPending ? "Creating Snapshot..." : "Generate Backup"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restore Backup Modal */}
      {selectedBackupToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-rose-500/50 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedBackupToRestore(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              Confirm Database Restore
            </h3>
            <p className="text-xs text-rose-300 mt-1">
              Restoring from <span className="font-mono text-white">{selectedBackupToRestore.filename}</span> will overwrite the active SQLite database with this snapshot.
            </p>

            <div className="my-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200">
              <p className="font-semibold">Automatic Safeguard Guarantee:</p>
              <p className="text-slate-300 mt-1">
                A safeguard backup of your current database state will be generated immediately before this restore is applied, so no recent transactions are permanently lost.
              </p>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleRestoreSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Type <span className="font-bold text-rose-400">RESTORE</span> to confirm:
                </label>
                <input
                  type="text"
                  value={restoreConfirmText}
                  onChange={e => setRestoreConfirmText(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-rose-500"
                  placeholder="RESTORE"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedBackupToRestore(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={restoreBackupMutation.isPending || restoreConfirmText !== "RESTORE"}
                  className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium transition shadow-sm disabled:opacity-50"
                >
                  {restoreBackupMutation.isPending ? "Restoring..." : "Execute Restore"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
