/**
 * Login page — professional dark-themed login for Billiard Hall Management System.
 * Authenticates against the backend. No public registration.
 */
import React, { useState } from "react";
import { CircleDot, Lock, User, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

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
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Invalid username or password. Please try again.");
        return;
      }

      const data = await res.json();
      login(data.token, data.username);
      onLoginSuccess();
    } catch {
      setError("Cannot reach the server. Make sure the backend is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#0F172A" }}>
      {/* Background subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 30% 40%, rgba(56,189,248,0.04) 0%, transparent 60%), radial-gradient(circle at 70% 70%, rgba(56,189,248,0.03) 0%, transparent 50%)",
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: "linear-gradient(135deg, #38BDF8 0%, #0EA5E9 100%)", boxShadow: "0 0 24px rgba(56,189,248,0.3)" }}
          >
            <CircleDot className="w-7 h-7 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "#F8FAFC" }}>
            Billiard Hall Management
          </h1>
          <p className="text-sm mt-1" style={{ color: "#64748B" }}>
            Sign in to continue
          </p>
        </div>

        {/* Login Card */}
        <div
          className="rounded-xl p-7"
          style={{ backgroundColor: "#1E293B", border: "1px solid #334155" }}
        >
          <form onSubmit={handleSubmit} className="space-y-5" id="login-form">
            {/* Error Alert */}
            {error && (
              <div
                className="flex items-start gap-2.5 rounded-lg p-3 text-sm"
                style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#FCA5A5" }}
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#EF4444" }} />
                <span>{error}</span>
              </div>
            )}

            {/* Username */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#94A3B8" }} htmlFor="login-username">
                Username
              </label>
              <div className="relative">
                <User
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: "#64748B" }}
                />
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  placeholder="admin"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm transition-fast"
                  style={{
                    backgroundColor: "#0F172A",
                    border: "1px solid #475569",
                    color: "#F8FAFC",
                  }}
                  onFocus={e => (e.target.style.borderColor = "#38BDF8")}
                  onBlur={e => (e.target.style.borderColor = "#475569")}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#94A3B8" }} htmlFor="login-password">
                Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: "#64748B" }}
                />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 rounded-lg text-sm transition-fast"
                  style={{
                    backgroundColor: "#0F172A",
                    border: "1px solid #475569",
                    color: "#F8FAFC",
                  }}
                  onFocus={e => (e.target.style.borderColor = "#38BDF8")}
                  onBlur={e => (e.target.style.borderColor = "#475569")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-fast"
                  style={{ color: "#64748B" }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="w-full py-2.5 rounded-lg font-medium text-sm transition-fast disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: "#38BDF8",
                color: "#0F172A",
              }}
              onMouseEnter={e => { if (!loading) (e.target as HTMLElement).style.backgroundColor = "#7DD3FC"; }}
              onMouseLeave={e => { if (!loading) (e.target as HTMLElement).style.backgroundColor = "#38BDF8"; }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-5" style={{ color: "#475569" }}>
          Billiard Hall · Local Management System
        </p>
      </div>
    </div>
  );
};
