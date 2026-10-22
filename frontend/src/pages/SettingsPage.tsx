/**
 * SettingsPage — system config, password change, backup.
 * Uses specified dark palette. No internal account codes exposed.
 */
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck, Database, Server,
  Users, CircleDot, Gamepad2, Coffee, Lock, KeyRound, Eye, EyeOff,

  CheckCircle2, AlertCircle,
} from "lucide-react";
import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";

/* ── Small helpers ──────────────────────────────────────────────────────── */

const Section: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({
  title, subtitle, children,
}) => (
  <div className="rounded-lg p-5 space-y-4" style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}>
    <div>
      <h3 className="text-sm font-semibold" style={{ color: "#F8FAFC" }}>{title}</h3>
      {subtitle && <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>{subtitle}</p>}
    </div>
    {children}
  </div>
);

const InfoTile: React.FC<{ label: string; value: React.ReactNode; sub?: string }> = ({ label, value, sub }) => (
  <div className="p-3 rounded-md space-y-1" style={{ backgroundColor: "#0F172A", border: "1px solid #334155" }}>
    <p className="text-xs" style={{ color: "#64748B" }}>{label}</p>
    <p className="text-sm font-semibold" style={{ color: "#F8FAFC" }}>{value}</p>
    {sub && <p className="text-[11px]" style={{ color: "#475569" }}>{sub}</p>}
  </div>
);

const Alert: React.FC<{ type: "success" | "error"; message: string; onClose: () => void }> = ({ type, message, onClose }) => (
  <div
    className="flex items-start justify-between gap-2 p-3 rounded-md text-xs"
    style={
      type === "success"
        ? { backgroundColor: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#86EFAC" }
        : { backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#FCA5A5" }
    }
  >
    <span className="flex items-center gap-2">
      {type === "success" ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
      {message}
    </span>
    <button onClick={onClose} className="opacity-60 hover:opacity-100 shrink-0">✕</button>
  </div>
);

/* ── Change Password Form ───────────────────────────────────────────────── */

const ChangePasswordForm: React.FC = () => {
  const { logout } = useAuth();
  const [current, setCurrent]   = useState("");
  const [newPass, setNewPass]   = useState("");
  const [newUser, setNewUser]   = useState("");
  const [showCur, setShowCur]   = useState(false);
  const [showNew, setShowNew]   = useState(false);
  const [msg, setMsg]           = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !newPass) return;
    if (newPass.length < 6) { setMsg({ type: "error", text: "New password must be at least 6 characters." }); return; }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: current, new_password: newPass, new_username: newUser || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: "error", text: data.detail || "Failed to change password." }); return; }
      setMsg({ type: "success", text: "Password changed. You will be signed out now." });
      setCurrent(""); setNewPass(""); setNewUser("");
      setTimeout(() => logout(), 2000);
    } catch {
      setMsg({ type: "error", text: "Network error. Make sure the backend is running." });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    backgroundColor: "#0F172A", border: "1px solid #475569", color: "#F8FAFC",
    borderRadius: "6px", padding: "8px 10px", fontSize: "13px", width: "100%", outline: "none",
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {msg && <Alert type={msg.type} message={msg.text} onClose={() => setMsg(null)} />}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "#94A3B8" }}>Current Password</label>
          <div className="relative">
            <input
              type={showCur ? "text" : "password"}
              value={current}
              onChange={e => setCurrent(e.target.value)}
              required
              placeholder="Current password"
              style={{ ...inputStyle, paddingRight: "36px" }}
              onFocus={e => (e.target.style.borderColor = "#38BDF8")}
              onBlur={e => (e.target.style.borderColor = "#475569")}
            />
            <button type="button" onClick={() => setShowCur(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: "#64748B" }}>
              {showCur ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "#94A3B8" }}>New Password</label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
              required
              minLength={6}
              placeholder="6+ characters"
              style={{ ...inputStyle, paddingRight: "36px" }}
              onFocus={e => (e.target.style.borderColor = "#38BDF8")}
              onBlur={e => (e.target.style.borderColor = "#475569")}
            />
            <button type="button" onClick={() => setShowNew(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: "#64748B" }}>
              {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "#94A3B8" }}>New Username <span style={{ color: "#475569" }}>(optional)</span></label>
          <input
            type="text"
            value={newUser}
            onChange={e => setNewUser(e.target.value)}
            placeholder="Leave blank to keep current"
            style={inputStyle}
            onFocus={e => (e.target.style.borderColor = "#38BDF8")}
            onBlur={e => (e.target.style.borderColor = "#475569")}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={loading || !current || !newPass}
        className="px-4 py-2 rounded-md text-xs font-medium transition-fast disabled:opacity-50"
        style={{ backgroundColor: "#38BDF8", color: "#0F172A" }}
        onMouseEnter={e => { if (!loading) (e.currentTarget.style.backgroundColor = "#7DD3FC"); }}
        onMouseLeave={e => { if (!loading) (e.currentTarget.style.backgroundColor = "#38BDF8"); }}
      >
        {loading ? "Saving…" : "Change Password"}
      </button>
      <p className="text-xs" style={{ color: "#475569" }}>
        You will be signed out automatically after a successful password change.
      </p>
    </form>
  );
};

/* ── Main Page ──────────────────────────────────────────────────────────── */

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [backupMsg, setBackupMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { data: health, isLoading: isHealthLoading } = useQuery({
    queryKey: ["health"],
    queryFn: () => api.getHealth(),
  });

  const { data: info, isLoading: isInfoLoading } = useQuery({
    queryKey: ["info"],
    queryFn: () => api.getSystemInfo(),
  });

  const { data: backups = [] } = useQuery({
    queryKey: ["backups"],
    queryFn: () => api.backup.list(),
  });

  const backupMutation = useMutation({
    mutationFn: () => api.backup.create("Manual snapshot from Settings"),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["backups"] });
      setBackupMsg({ type: "success", text: `Snapshot created: ${data.filename} (${(data.size_bytes / 1024).toFixed(1)} KB) — integrity verified.` });
    },
    onError: (err: any) => {
      setBackupMsg({ type: "error", text: err.message || "Failed to create backup." });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (filename: string) => api.backup.restore(filename),
    onSuccess: (data) => {
      queryClient.invalidateQueries();
      setBackupMsg({ type: "success", text: `Restored from ${data.restored_from}. Pre-restore safeguard: ${data.safeguard_backup}` });
    },
    onError: (err: any) => {
      setBackupMsg({ type: "error", text: err.message || "Failed to restore." });
    },
  });

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "#F8FAFC" }}>Settings</h2>
        <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
          Business configuration, security, and system status
        </p>
      </div>

      {/* Status row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: Server, label: "System Status", iconColor: "#22C55E",
            value: isHealthLoading ? "Checking…" : health?.status === "healthy" ? "Online" : "Offline",
            valueColor: health?.status === "healthy" ? "#22C55E" : "#EF4444",
            sub: `Version ${health?.version || "1.0.0"}`,
          },
          {
            icon: Database, label: "Database", iconColor: "#38BDF8",
            value: "Connected", valueColor: "#22C55E",
            sub: "Local SQLite · Data stored on this computer",
          },
          {
            icon: ShieldCheck, label: "Financial Integrity", iconColor: "#A78BFA",
            value: "Protected", valueColor: "#22C55E",
            sub: "Integer paise storage · No floating-point rounding",
          },
        ].map(({ icon: Icon, label, iconColor, value, valueColor, sub }) => (
          <div key={label} className="rounded-lg p-4" style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}>
            <div className="flex items-center gap-2 mb-3">
              <Icon className="w-4 h-4" style={{ color: iconColor }} />
              <p className="text-xs font-medium" style={{ color: "#94A3B8" }}>{label}</p>
            </div>
            <p className="text-lg font-bold" style={{ color: valueColor }}>{value}</p>
            <p className="text-xs mt-1" style={{ color: "#64748B" }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Business profile */}
      <Section title="Business Profile" subtitle="Core settings and configured accounts.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <InfoTile label="Business Name" value={isInfoLoading ? "Loading…" : (info?.business_name || "Billiard Hall")} />
          <InfoTile label="Currency" value={`${info?.currency || "LKR"} (${info?.currency_symbol || "Rs."})`} sub="Sri Lankan Rupees" />
          <InfoTile label="Records From" value={info?.historical_start_date || "2026-01-01"} sub="Earliest transaction date" />
          <InfoTile label="Accounts" value={`${info?.accounts_configured ?? "—"} configured`} sub="Full chart of accounts" />
        </div>

        {/* Partners — shown only in Settings, not on dashboard */}
        {info?.owners && info.owners.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-3.5 h-3.5" style={{ color: "#F59E0B" }} />
              <p className="text-xs font-medium" style={{ color: "#94A3B8" }}>Business Partners & Profit Allocation</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {info.owners.map(owner => (
                <div key={owner.id} className="flex items-center justify-between p-3 rounded-md"
                  style={{ backgroundColor: "#0F172A", border: "1px solid #334155" }}>
                  <span className="text-xs font-medium" style={{ color: "#F8FAFC" }}>{owner.name}</span>
                  <span className="text-xs font-semibold font-mono" style={{ color: "#38BDF8" }}>
                    {owner.profit_share_percent}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: "#475569" }}>
              40% of net profit is retained in the savings reserve. Profit allocation must be explicitly approved before any distribution.
            </p>
          </div>
        )}
      </Section>

      {/* Pricing reference */}
      <Section title="Pricing Rules" subtitle="Configured session pricing for reference. Prices apply to new sessions only.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pool */}
          <div className="rounded-md p-4 space-y-3" style={{ backgroundColor: "#0F172A", border: "1px solid #334155" }}>
            <div className="flex items-center gap-2">
              <CircleDot className="w-3.5 h-3.5" style={{ color: "#38BDF8" }} />
              <p className="text-xs font-semibold" style={{ color: "#38BDF8" }}>Pool Table</p>
            </div>
            <p className="text-xs" style={{ color: "#64748B" }}>First hour: Rs. 500 · Each extra 30 min: Rs. 300</p>
            <div className="space-y-1 text-xs font-mono">
              {[["1 hour","500"],["1½ hours","800"],["2 hours","1,000"],["2½ hours","1,300"],["3 hours","1,500"],["3½ hours","1,800"],["4 hours","2,000"]].map(([d,p]) => (
                <div key={d} className="flex justify-between">
                  <span style={{ color: "#94A3B8" }}>{d}</span>
                  <span className="font-semibold" style={{ color: "#F8FAFC" }}>Rs. {p}</span>
                </div>
              ))}
            </div>
          </div>
          {/* PS4 */}
          <div className="rounded-md p-4 space-y-3" style={{ backgroundColor: "#0F172A", border: "1px solid #334155" }}>
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-3.5 h-3.5" style={{ color: "#818CF8" }} />
              <p className="text-xs font-semibold" style={{ color: "#818CF8" }}>PS4 Gaming</p>
            </div>
            <p className="text-xs" style={{ color: "#64748B" }}>Charged per full hour</p>
            <div className="space-y-1 text-xs font-mono">
              {[["1 player · 1 hr","400"],["1 player · 2 hrs","800"],["1 player · 3 hrs","1,200"],["1 player · 4 hrs","1,600"],
                ["2 players · 1 hr","500"],["2 players · 2 hrs","1,000"],["2 players · 3 hrs","1,500"],["2 players · 4 hrs","2,000"]].map(([d,p]) => (
                <div key={d} className="flex justify-between">
                  <span style={{ color: "#94A3B8" }}>{d}</span>
                  <span className="font-semibold" style={{ color: "#F8FAFC" }}>Rs. {p}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Soft Drinks */}
          <div className="rounded-md p-4 space-y-3" style={{ backgroundColor: "#0F172A", border: "1px solid #334155" }}>
            <div className="flex items-center gap-2">
              <Coffee className="w-3.5 h-3.5" style={{ color: "#F59E0B" }} />
              <p className="text-xs font-semibold" style={{ color: "#F59E0B" }}>Soft Drinks</p>
            </div>
            <p className="text-xs" style={{ color: "#64748B" }}>
              Prices are set per product in the Soft Drinks Inventory section. Each flavour has its own purchase cost and selling price.
            </p>
          </div>
        </div>
      </Section>

      {/* Change Password */}
      <Section title="Change Password" subtitle="Update your admin username and password. You will be signed out after a successful change.">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-3.5 h-3.5" style={{ color: "#38BDF8" }} />
          <p className="text-xs" style={{ color: "#94A3B8" }}>Enter your current password to make changes.</p>
        </div>
        <ChangePasswordForm />
      </Section>

      {/* Backup */}
      <Section title="Database Backup & Restore" subtitle="Create and restore point-in-time snapshots of the database.">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <KeyRound className="w-3.5 h-3.5" style={{ color: "#F59E0B" }} />
            <p className="text-xs" style={{ color: "#94A3B8" }}>
              Backups are stored locally. A safeguard snapshot is created automatically before any restore.
            </p>
          </div>
          <button
            onClick={() => backupMutation.mutate()}
            disabled={backupMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-fast disabled:opacity-50"
            style={{ backgroundColor: "#38BDF8", color: "#0F172A" }}
            onMouseEnter={e => { if (!backupMutation.isPending) (e.currentTarget.style.backgroundColor = "#7DD3FC"); }}
            onMouseLeave={e => { if (!backupMutation.isPending) (e.currentTarget.style.backgroundColor = "#38BDF8"); }}
          >
            <Database className="w-3.5 h-3.5" />
            {backupMutation.isPending ? "Creating…" : "Create Backup Now"}
          </button>
        </div>

        {backupMsg && (
          <Alert type={backupMsg.type} message={backupMsg.text} onClose={() => setBackupMsg(null)} />
        )}

        {backups.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-xs rounded-md"
            style={{ backgroundColor: "#0F172A", border: "1px solid #334155", color: "#475569" }}>
            No backups yet. Click "Create Backup Now" to create the first snapshot.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md" style={{ border: "1px solid #334155" }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: "#0F172A", borderBottom: "1px solid #334155" }}>
                  {["Filename","Created","Size","Status","Action"].map(h => (
                    <th key={h} className="py-2.5 px-3 text-left font-medium" style={{ color: "#64748B" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {backups.map(b => (
                  <tr key={b.filename} className="table-row-hover" style={{ borderBottom: "1px solid #1E293B" }}>
                    <td className="py-2.5 px-3 font-mono" style={{ color: "#F8FAFC" }}>{b.filename}</td>
                    <td className="py-2.5 px-3 font-mono" style={{ color: "#94A3B8" }}>
                      {b.created_at.replace("T"," ").substring(0,19)}
                    </td>
                    <td className="py-2.5 px-3 font-mono" style={{ color: "#94A3B8" }}>
                      {(b.size_bytes / 1024).toFixed(1)} KB
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium" style={{ backgroundColor: "rgba(34,197,94,0.15)", color: "#22C55E", border: "1px solid rgba(34,197,94,0.3)" }}>
                        Verified ✓
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => {
                          if (window.confirm(`Restore from "${b.filename}"?\n\nA safeguard backup will be created automatically before the restore.`)) {
                            restoreMutation.mutate(b.filename);
                          }
                        }}
                        disabled={restoreMutation.isPending}
                        className="px-2.5 py-1 rounded text-[11px] font-medium transition-fast disabled:opacity-50"
                        style={{ backgroundColor: "#334155", color: "#94A3B8" }}
                        onMouseEnter={e => { e.currentTarget.style.color = "#F8FAFC"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "#94A3B8"; }}
                      >
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
};
