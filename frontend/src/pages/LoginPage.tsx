/**
 * LoginPage — Modern split-screen authentication for Pool Town ERP.
 * Blue & white card layout with Pool Town branding, decorative geometry,
 * and high-contrast accessible inputs.
 */
import React, { useState } from "react";
import { Lock, User, Eye, EyeOff, AlertCircle, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          setError("Too many login attempts. Please try again in a few minutes.");
        } else if (res.status === 401 || res.status === 400) {
          setError("Invalid username or password.");
        } else {
          setError("Authentication failed. Please verify your credentials.");
        }
        return;
      }

      const data = await res.json();
      login(data.token, data.username);
      onLoginSuccess();
    } catch {
      setError("Unable to connect to the server. Please ensure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 relative selection:bg-blue-200 selection:text-blue-900"
      style={{
        background: "linear-gradient(135deg, #1E3A8A 0%, #0F172A 60%, #090D16 100%)",
        fontFamily: "var(--font-family-base, 'Poppins', sans-serif)",
      }}
    >
      {/* Subtle atmospheric ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, rgba(56, 189, 248, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(30, 64, 175, 0.25) 0%, transparent 60%)",
        }}
      />

      {/* Main Login Card (Split-screen 2-column) */}
      <div
        className="relative w-full max-w-[1080px] min-h-[540px] rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-700/50"
        style={{
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.05)",
        }}
      >
        {/* =========================================================================
            LEFT PANEL: Welcome & Branding (~48% width on desktop)
            ========================================================================= */}
        <div
          className="w-full md:w-[48%] relative flex flex-col justify-between p-8 sm:p-10 lg:p-12 text-white overflow-hidden"
          style={{
            background: "linear-gradient(150deg, #1D4ED8 0%, #1E40AF 45%, #0F172A 100%)",
          }}
        >
          {/* Decorative circular shapes (depth & layering) */}
          <div
            className="absolute -bottom-24 -left-20 w-80 h-80 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(56, 189, 248, 0.2) 0%, rgba(30, 64, 175, 0.05) 70%)",
            }}
          />
          <div
            className="absolute bottom-12 -right-16 w-56 h-56 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(96, 165, 250, 0.18) 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute -top-16 -right-12 w-64 h-64 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(147, 197, 253, 0.15) 0%, transparent 70%)",
            }}
          />

          {/* Top Brand Tag */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-xl sm:text-2xl font-extrabold tracking-wider text-white">
                POOL TOWN
              </span>
            </div>
            <span className="text-[11px] font-medium uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/10 text-blue-200 border border-white/10">
              ERP System
            </span>
          </div>

          {/* Center: Official Logo container + Welcome Copy */}
          <div className="relative z-10 my-8 sm:my-10 space-y-5">
            {/* Logo in light container for high legibility */}
            <div
              className="inline-flex items-center justify-center p-3 rounded-2xl bg-white shadow-xl transition-transform hover:scale-[1.02]"
              style={{
                width: "96px",
                height: "96px",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2)",
              }}
            >
              <img
                src="/images/pool-town-logo.jpeg"
                alt="Pool Town Official Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  // Fallback in case of missing asset
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>

            <div>
              <p className="text-xs uppercase tracking-widest font-semibold text-blue-200 mb-1">
                Management &amp; Accounting
              </p>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white leading-tight">
                WELCOME BACK
              </h2>
              <p className="text-sm text-blue-100/90 mt-2 leading-relaxed max-w-sm">
                Your business, sessions, and accounts — all in one place.
              </p>
            </div>
          </div>

          {/* Bottom security assurance */}
          <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-blue-200/80">
            <span>Enterprise Edition</span>
            <span>Local &amp; Secure</span>
          </div>
        </div>

        {/* =========================================================================
            RIGHT PANEL: Clean White Authentication Form (~52% width)
            ========================================================================= */}
        <div className="w-full md:w-[52%] bg-white p-8 sm:p-12 lg:p-14 flex flex-col justify-center text-slate-800">
          <div className="max-w-md w-full mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Sign in
              </h1>
              <p className="text-sm text-slate-500 mt-1.5">
                Access your Pool Town management system
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div
                className="mb-6 flex items-start gap-3 rounded-xl p-3.5 text-xs sm:text-sm animate-fadeIn"
                style={{
                  backgroundColor: "#FEF2F2",
                  border: "1px solid #FCA5A5",
                  color: "#991B1B",
                }}
                role="alert"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
                <span className="font-medium leading-relaxed">{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5" id="login-form">
              {/* Username Field */}
              <div>
                <label
                  htmlFor="login-username"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
                >
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    id="login-username"
                    name="username"
                    type="text"
                    autoComplete="off"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="Enter your username"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm transition-all outline-none bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-11 py-3 rounded-xl text-sm transition-all outline-none bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  id="login-submit"
                  type="submit"
                  disabled={loading || !username.trim() || !password}
                  className="w-full py-3.5 px-5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  style={{
                    backgroundColor: "#0F172A",
                    color: "#FFFFFF",
                    boxShadow: "0 4px 14px 0 rgba(15, 23, 42, 0.3)",
                  }}
                  onMouseEnter={(e) => {
                    if (!loading && username.trim() && password) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = "#1E293B";
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "#0F172A";
                  }}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Signing in…
                    </span>
                  ) : (
                    <>
                      <span>Sign in</span>
                      <ArrowRight className="w-4 h-4 text-slate-300" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Note / System info */}
            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>Pool Town ERP</span>
              <span>All rights reserved</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
