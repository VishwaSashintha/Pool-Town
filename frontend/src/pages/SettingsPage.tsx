/**
 * SettingsPage — Essential ERP Configuration.
 * Simplified into 3 practical, clean tabs:
 * 1. Pricing & Rates (Editable Pool, PS4, and drink catalog pricing with admin verification)
 * 2. Security & Credentials (Admin password and Edit-PIN management)
 * 3. Backup & Recovery (Manual snapshots and safe database restore)
 */
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  CircleDot,
  Gamepad2,
  Coffee,
  Database,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Shield,
  Edit3,
  X,
  ExternalLink,
} from "lucide-react";
import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { formatLKR, rupeesToPaise, paiseToRupees } from "@/lib/money";
import type { BackupSnapshot, PricingRatesResponse } from "@/types";

/* ── UI Helpers ─────────────────────────────────────────────────────────── */

const SectionCard: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  badge?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, icon: Icon, badge, action, children }) => (
  <div
    className="rounded-xl p-6 space-y-5"
    style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
  >
    <div className="flex items-start justify-between gap-3 border-b border-slate-700/60 pb-4">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2 rounded-lg" style={{ backgroundColor: "#0F172A", border: "1px solid #334155" }}>
            <Icon className="w-5 h-5 text-sky-400" />
          </div>
        )}
        <div>
          <h3 className="text-base font-semibold text-slate-100">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {badge && (
          <span
            className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{
              backgroundColor: "rgba(56,189,248,0.1)",
              color: "#38BDF8",
              border: "1px solid rgba(56,189,248,0.2)",
            }}
          >
            {badge}
          </span>
        )}
        {action}
      </div>
    </div>
    {children}
  </div>
);

const AlertBanner: React.FC<{
  type: "success" | "error";
  message: string;
  onClose: () => void;
}> = ({ type, message, onClose }) => (
  <div
    className="flex items-start justify-between gap-2.5 p-3.5 rounded-lg text-xs"
    style={
      type === "success"
        ? { backgroundColor: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#86EFAC" }
        : { backgroundColor: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#FCA5A5" }
    }
  >
    <span className="flex items-center gap-2">
      {type === "success" ? (
        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
      ) : (
        <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
      )}
      <span className="font-medium leading-relaxed">{message}</span>
    </span>
    <button onClick={onClose} className="opacity-70 hover:opacity-100 text-sm px-1">✕</button>
  </div>
);

/* ── Tab 1: Pricing & Rates (Editable with Admin Auth) ───────────────────── */

const PricingTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [adminUser, setAdminUser] = useState("admin");
  const [adminPass, setAdminPass] = useState("");
  const [showPass, setShowPass] = useState(false);

  // Form rates in rupees
  const [poolBaseRupees, setPoolBaseRupees] = useState(500);
  const [poolBlockRupees, setPoolBlockRupees] = useState(300);
  const [ps41pRupees, setPs41pRupees] = useState(400);
  const [ps42pRupees, setPs42pRupees] = useState(500);

  const { data: rates, isLoading } = useQuery<PricingRatesResponse>({
    queryKey: ["pricing-rates"],
    queryFn: () => api.pricing.getRates(),
  });

  const openEditModal = () => {
    if (rates) {
      setPoolBaseRupees(paiseToRupees(rates.pool_base_charge_paise));
      setPoolBlockRupees(paiseToRupees(rates.pool_block_charge_paise));
      setPs41pRupees(paiseToRupees(rates.ps4_1player_rate_paise));
      setPs42pRupees(paiseToRupees(rates.ps4_2players_rate_paise));
    }
    setAdminPass("");
    setIsEditModalOpen(true);
  };

  const updateRatesMutation = useMutation({
    mutationFn: () =>
      api.pricing.updateRates({
        admin_username: adminUser.trim(),
        admin_password: adminPass,
        pool_base_charge_paise: rupeesToPaise(poolBaseRupees),
        pool_block_charge_paise: rupeesToPaise(poolBlockRupees),
        ps4_1player_rate_paise: rupeesToPaise(ps41pRupees),
        ps4_2players_rate_paise: rupeesToPaise(ps42pRupees),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["pricing-rates"], data);
      setIsEditModalOpen(false);
      setAdminPass("");
      setMsg({
        type: "success",
        text: "Pricing rates updated successfully. New sessions will automatically use these rates.",
      });
    },
    onError: (err: any) => {
      setMsg({
        type: "error",
        text: err.message || "Failed to update pricing rates. Please verify administrator credentials.",
      });
    },
  });

  const handleSaveRates = (e: React.FormEvent) => {
    e.preventDefault();
    if (poolBaseRupees < 0 || poolBlockRupees < 0 || ps41pRupees < 0 || ps42pRupees < 0) {
      setMsg({ type: "error", text: "Rates cannot be negative." });
      return;
    }
    if (!adminPass) {
      setMsg({ type: "error", text: "Administrator password is required." });
      return;
    }
    updateRatesMutation.mutate();
  };

  const poolBase = rates?.pool_base_charge_paise ?? 50000;
  const poolBlock = rates?.pool_block_charge_paise ?? 30000;
  const ps41p = rates?.ps4_1player_rate_paise ?? 40000;
  const ps42p = rates?.ps4_2players_rate_paise ?? 50000;

  // Calculate standard pool durations for preview table
  const calcPool = (mins: number) => {
    if (mins <= 60) return poolBase;
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    if (rem === 0) return hours * poolBase;
    if (rem <= 30) return hours * poolBase + poolBlock;
    return (hours + 1) * poolBase;
  };

  return (
    <div className="space-y-6">
      {msg && <AlertBanner type={msg.type} message={msg.text} onClose={() => setMsg(null)} />}

      {/* Top Banner & Edit Button */}
      <div
        className="rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
      >
        <div>
          <h2 className="text-base font-bold text-white">Operating Prices & Rates</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Prices apply to all newly started sessions. Historical transactions remain protected and unchanged.
          </p>
        </div>
        <button
          onClick={openEditModal}
          disabled={isLoading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold shadow-md transition-colors whitespace-nowrap cursor-pointer"
          style={{ backgroundColor: "#38BDF8", color: "#0F172A" }}
        >
          <Edit3 className="w-4 h-4" />
          <span>Edit Prices</span>
        </button>
      </div>

      {/* Rate Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pool Base */}
        <div className="p-4 rounded-xl space-y-1.5" style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}>
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <CircleDot className="w-4 h-4 text-sky-400" />
            <span>Pool — First Hour</span>
          </div>
          <p className="text-xl font-bold text-white">{formatLKR(poolBase)}</p>
          <p className="text-[11px] text-slate-400">Up to 60 minutes base play</p>
        </div>

        {/* Pool 30m block */}
        <div className="p-4 rounded-xl space-y-1.5" style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}>
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <CircleDot className="w-4 h-4 text-sky-400" />
            <span>Pool — Extension Block</span>
          </div>
          <p className="text-xl font-bold text-white">{formatLKR(poolBlock)}</p>
          <p className="text-[11px] text-slate-400">Per additional 30 minutes</p>
        </div>

        {/* PS4 1 Player */}
        <div className="p-4 rounded-xl space-y-1.5" style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}>
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <Gamepad2 className="w-4 h-4 text-indigo-400" />
            <span>PS4 — 1 Player</span>
          </div>
          <p className="text-xl font-bold text-white">{formatLKR(ps41p)}</p>
          <p className="text-[11px] text-slate-400">Per hour rate (single player)</p>
        </div>

        {/* PS4 2 Players */}
        <div className="p-4 rounded-xl space-y-1.5" style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}>
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <Gamepad2 className="w-4 h-4 text-indigo-400" />
            <span>PS4 — 2 Players</span>
          </div>
          <p className="text-xl font-bold text-white">{formatLKR(ps42p)}</p>
          <p className="text-[11px] text-slate-400">Per hour rate (two players)</p>
        </div>
      </div>

      {/* Pricing Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pool Table Schedule */}
        <SectionCard
          title="Pool Table Duration Schedule"
          subtitle="Calculated automatically using current base and extension rates."
          icon={CircleDot}
        >
          <div className="space-y-1.5 text-xs font-mono">
            {[
              ["30 min (within base)", 30],
              ["1 hour (60 min)", 60],
              ["1 hour 30 min (90 min)", 90],
              ["2 hours (120 min)", 120],
              ["2 hours 30 min (150 min)", 150],
              ["3 hours (180 min)", 180],
              ["3 hours 30 min (210 min)", 210],
              ["4 hours (240 min)", 240],
            ].map(([label, mins]) => {
              const charge = calcPool(mins as number);
              return (
                <div
                  key={label as string}
                  className="flex justify-between py-2 px-3 rounded-lg"
                  style={{ backgroundColor: "#0F172A", border: "1px solid #334155" }}
                >
                  <span className="text-slate-300 font-sans">{label}</span>
                  <span className="font-bold text-white font-mono">{formatLKR(charge)}</span>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* PS4 Schedule & Soft Drinks */}
        <div className="space-y-6">
          <SectionCard
            title="PS4 Gaming Schedule"
            subtitle="Hourly rate scaled by duration."
            icon={Gamepad2}
          >
            <div className="space-y-1.5 text-xs font-mono">
              {[
                ["1 hour (1 Player)", 1, ps41p],
                ["2 hours (1 Player)", 2, ps41p * 2],
                ["3 hours (1 Player)", 3, ps41p * 3],
                ["1 hour (2 Players)", 1, ps42p],
                ["2 hours (2 Players)", 2, ps42p * 2],
                ["3 hours (2 Players)", 3, ps42p * 3],
              ].map(([label, , total]) => (
                <div
                  key={label as string}
                  className="flex justify-between py-2 px-3 rounded-lg"
                  style={{ backgroundColor: "#0F172A", border: "1px solid #334155" }}
                >
                  <span className="text-slate-300 font-sans">{label}</span>
                  <span className="font-bold text-white font-mono">{formatLKR(total as number)}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Soft Drinks & Beverages"
            subtitle="Selling prices and stock costs are managed directly in inventory."
            icon={Coffee}
            action={
              <Link
                to="/drinks/inventory"
                className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 font-medium"
              >
                <span>Open Drinks Catalog</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            }
          >
            <p className="text-xs text-slate-400 leading-relaxed">
              Drink selling prices, purchase costs, and stock levels can be viewed and edited in the Soft Drinks Inventory page.
            </p>
          </SectionCard>
        </div>
      </div>

      {/* Edit Prices Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-5"
            style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
          >
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-sky-400" />
                <span>Edit Operating Prices</span>
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRates} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Pool Base Rate (Rs.)
                  </label>
                  <span className="text-[11px] text-slate-400 block mb-1.5">First 60 mins</span>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={poolBaseRupees}
                    onChange={(e) => setPoolBaseRupees(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 rounded-lg text-sm font-semibold bg-slate-900 border border-slate-700 text-white focus:border-sky-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Pool Extension Block (Rs.)
                  </label>
                  <span className="text-[11px] text-slate-400 block mb-1.5">Per 30 mins after 60 mins</span>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={poolBlockRupees}
                    onChange={(e) => setPoolBlockRupees(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 rounded-lg text-sm font-semibold bg-slate-900 border border-slate-700 text-white focus:border-sky-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    PS4 1 Player Rate (Rs./hr)
                  </label>
                  <span className="text-[11px] text-slate-400 block mb-1.5">Per hour</span>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={ps41pRupees}
                    onChange={(e) => setPs41pRupees(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 rounded-lg text-sm font-semibold bg-slate-900 border border-slate-700 text-white focus:border-sky-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    PS4 2 Players Rate (Rs./hr)
                  </label>
                  <span className="text-[11px] text-slate-400 block mb-1.5">Per hour</span>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={ps42pRupees}
                    onChange={(e) => setPs42pRupees(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 rounded-lg text-sm font-semibold bg-slate-900 border border-slate-700 text-white focus:border-sky-400 outline-none"
                  />
                </div>
              </div>

              {/* Admin Authorization section */}
              <div
                className="p-4 rounded-xl space-y-3 mt-4"
                style={{ backgroundColor: "#0F172A", border: "1px solid #334155" }}
              >
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                  <Shield className="w-4 h-4" />
                  <span>Administrator Authorization Required</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Admin Username</label>
                    <input
                      type="text"
                      value={adminUser}
                      onChange={(e) => setAdminUser(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg text-xs bg-slate-800 border border-slate-700 text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Admin Password</label>
                    <div className="relative">
                      <input
                        type={showPass ? "text" : "password"}
                        value={adminPass}
                        onChange={(e) => setAdminPass(e.target.value)}
                        required
                        placeholder="Enter password"
                        className="w-full px-3 py-2 pr-9 rounded-lg text-xs bg-slate-800 border border-slate-700 text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateRatesMutation.isPending}
                  className="px-5 py-2 rounded-lg text-xs font-semibold shadow-md cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: "#38BDF8", color: "#0F172A" }}
                >
                  {updateRatesMutation.isPending ? "Saving Changes…" : "Save New Rates"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Tab 2: Security & Credentials ───────────────────────────────────────── */

const SecurityTab: React.FC = () => {
  const { logout } = useAuth();
  const [passMsg, setPassMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pinMsg, setPinMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password fields
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [showCurPass, setShowCurPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passLoading, setPassLoading] = useState(false);

  // PIN fields
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);
    if (newPass.length < 6) {
      setPassMsg({ type: "error", text: "New password must be at least 6 characters long." });
      return;
    }
    setPassLoading(true);
    try {
      await api.auth.changePassword(currentPass, newPass, newUsername.trim() || undefined);
      setPassMsg({
        type: "success",
        text: "Password updated successfully. Logging out in 2 seconds…",
      });
      setTimeout(() => logout(), 2000);
    } catch (err: any) {
      setPassMsg({ type: "error", text: err.message || "Failed to change password. Please verify current password." });
    } finally {
      setPassLoading(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMsg(null);
    if (newPin !== confirmPin) {
      setPinMsg({ type: "error", text: "New PIN and confirmation PIN do not match." });
      return;
    }
    setPinLoading(true);
    try {
      await api.auth.changePin(currentPin, newPin);
      setPinMsg({ type: "success", text: "Edit-Authorization PIN changed successfully." });
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    } catch (err: any) {
      setPinMsg({ type: "error", text: err.message || "Failed to change PIN. Verify current PIN." });
    } finally {
      setPinLoading(false);
    }
  };

  const inputStyle = {
    backgroundColor: "#0F172A",
    border: "1px solid #475569",
    color: "#F8FAFC",
    borderRadius: "8px",
    padding: "9px 12px",
    fontSize: "13px",
    width: "100%",
    outline: "none",
  };

  return (
    <div className="space-y-6">
      {/* Change Password */}
      <SectionCard
        title="Change Admin Password"
        subtitle="Update login credentials for administrative access."
        icon={Lock}
      >
        {passMsg && <AlertBanner type={passMsg.type} message={passMsg.text} onClose={() => setPassMsg(null)} />}

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Current Password</label>
              <div className="relative">
                <input
                  type={showCurPass ? "text" : "password"}
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                  required
                  placeholder="Enter current password"
                  style={{ ...inputStyle, paddingRight: "38px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowCurPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showCurPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showNewPass ? "text" : "password"}
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Min 6 characters"
                  style={{ ...inputStyle, paddingRight: "38px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                New Username <span className="text-slate-500">(optional)</span>
              </label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Leave blank to keep current"
                style={inputStyle}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-500">
              For security, you will be signed out immediately after a successful password change.
            </p>
            <button
              type="submit"
              disabled={passLoading || !currentPass || !newPass}
              className="px-5 py-2.5 rounded-lg text-xs font-semibold shadow-md cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: "#38BDF8", color: "#0F172A" }}
            >
              {passLoading ? "Updating…" : "Update Password"}
            </button>
          </div>
        </form>
      </SectionCard>

      {/* Change Edit-Auth PIN */}
      <SectionCard
        title="Edit-Authorization PIN"
        subtitle="Used across the ERP to authorize session adjustments, retroactive edits, and sale voids."
        icon={KeyRound}
      >
        {pinMsg && <AlertBanner type={pinMsg.type} message={pinMsg.text} onClose={() => setPinMsg(null)} />}

        <form onSubmit={handlePinSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Current PIN</label>
              <input
                type={showPin ? "text" : "password"}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                required
                placeholder="Enter current PIN"
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">New PIN</label>
              <input
                type={showPin ? "text" : "password"}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                required
                placeholder="e.g. 4-6 digits"
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Confirm New PIN</label>
              <input
                type={showPin ? "text" : "password"}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                required
                placeholder="Re-enter new PIN"
                style={inputStyle}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setShowPin((v) => !v)}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPin ? "Hide PIN digits" : "Show PIN digits"}</span>
            </button>

            <button
              type="submit"
              disabled={pinLoading || !currentPin || !newPin || newPin !== confirmPin}
              className="px-5 py-2.5 rounded-lg text-xs font-semibold shadow-md cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: "#38BDF8", color: "#0F172A" }}
            >
              {pinLoading ? "Saving PIN…" : "Change Authorization PIN"}
            </button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
};

/* ── Tab 3: Backup & Recovery ────────────────────────────────────────────── */

const BackupTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [backupMsg, setBackupMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { data: backups = [], isLoading } = useQuery<BackupSnapshot[]>({
    queryKey: ["backups"],
    queryFn: () => api.backup.list(),
  });

  const backupMutation = useMutation({
    mutationFn: () => api.backup.create("Manual snapshot from Pool Town Settings"),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["backups"] });
      setBackupMsg({
        type: "success",
        text: `Backup snapshot created: ${data.filename} (${(data.size_bytes / 1024).toFixed(1)} KB) — integrity verified.`,
      });
    },
    onError: (err: any) => {
      setBackupMsg({ type: "error", text: err.message || "Failed to create backup." });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (filename: string) => api.backup.restore(filename),
    onSuccess: (data) => {
      queryClient.invalidateQueries();
      setBackupMsg({
        type: "success",
        text: `Restored successfully from ${data.restored_from}. Safeguard snapshot created: ${data.safeguard_backup}`,
      });
    },
    onError: (err: any) => {
      setBackupMsg({ type: "error", text: err.message || "Failed to restore backup snapshot." });
    },
  });

  return (
    <div className="space-y-6">
      {backupMsg && (
        <AlertBanner type={backupMsg.type} message={backupMsg.text} onClose={() => setBackupMsg(null)} />
      )}

      {/* Snapshot creation card */}
      <SectionCard
        title="Create Database Snapshot"
        subtitle="Generates an isolated, atomic copy of billiard.db in the backend backups directory."
        icon={Database}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
            Snapshots capture all tables, ledger transactions, player histories, and rate configurations in an atomic state.
          </p>
          <button
            onClick={() => backupMutation.mutate()}
            disabled={backupMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold shadow-md transition-fast disabled:opacity-50 cursor-pointer whitespace-nowrap"
            style={{ backgroundColor: "#38BDF8", color: "#0F172A" }}
          >
            <Database className="w-4 h-4" />
            <span>{backupMutation.isPending ? "Creating Snapshot…" : "Create Backup Snapshot"}</span>
          </button>
        </div>
      </SectionCard>

      {/* Existing snapshots list */}
      <SectionCard
        title="Available Backup Snapshots"
        subtitle="Stored in ./backend/backups with cryptographic SHA-256 integrity hashes."
        badge={`${backups.length} snapshots`}
      >
        {isLoading ? (
          <div className="py-8 text-center text-xs text-slate-400">Scanning backups…</div>
        ) : backups.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No backup snapshots created yet. Click above to create one.
          </div>
        ) : (
          <div className="space-y-2">
            {backups.map((b) => (
              <div
                key={b.filename}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg gap-3"
                style={{ backgroundColor: "#0F172A", border: "1px solid #334155" }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-mono font-medium text-slate-200">{b.filename}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      {(b.size_bytes / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Created: {new Date(b.created_at).toLocaleString()} · {b.note || "No description"}
                  </p>
                </div>

                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        `Are you sure you want to restore "${b.filename}"? A safeguard backup of the current database will be created first.`
                      )
                    ) {
                      restoreMutation.mutate(b.filename);
                    }
                  }}
                  disabled={restoreMutation.isPending}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-amber-300 hover:bg-amber-500/10 border border-amber-500/30 transition-fast disabled:opacity-50 cursor-pointer self-start sm:self-auto"
                >
                  {restoreMutation.isPending ? "Restoring…" : "Restore from this Snapshot"}
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
};

/* ── Main SettingsPage Shell ────────────────────────────────────────────── */

type TabKey = "pricing" | "security" | "backup";

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("pricing");

  const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: "pricing", label: "Pricing & Rates", icon: CircleDot },
    { key: "security", label: "Security & Passwords", icon: Shield },
    { key: "backup", label: "Backup & Restore", icon: Database },
  ];

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
            Pool Town Settings
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Operating rates, administrative credentials, and database backups
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer"
              style={
                isActive
                  ? {
                      backgroundColor: "#38BDF8",
                      color: "#0F172A",
                      boxShadow: "0 4px 12px rgba(56, 189, 248, 0.25)",
                    }
                  : {
                      backgroundColor: "transparent",
                      color: "#94A3B8",
                    }
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === "pricing" && <PricingTab />}
        {activeTab === "security" && <SecurityTab />}
        {activeTab === "backup" && <BackupTab />}
      </div>
    </div>
  );
};
