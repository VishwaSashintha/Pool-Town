/**
 * Authentication context — manages session token, login/logout state.
 * Token stored in sessionStorage (not localStorage) so it clears on tab close.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface AuthContextType {
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
  login: (token: string, username: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "bh_session_token";
const USER_KEY  = "bh_session_user";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken]       = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const [username, setUsername] = useState<string | null>(() => sessionStorage.getItem(USER_KEY));

  const login = useCallback((t: string, u: string) => {
    sessionStorage.setItem(TOKEN_KEY, t);
    sessionStorage.setItem(USER_KEY, u);
    setToken(t);
    setUsername(u);
  }, []);

  const logout = useCallback(async () => {
    const t = sessionStorage.getItem(TOKEN_KEY);
    if (t) {
      try {
        await fetch(`/api/auth/logout?token=${encodeURIComponent(t)}`, { method: "POST" });
      } catch {
        // ignore network errors on logout
      }
    }
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setToken(null);
    setUsername(null);
  }, []);

  // Verify token is still valid on mount
  useEffect(() => {
    if (!token) return;
    fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`, { method: "POST" })
      .then(r => r.json())
      .then(data => {
        if (!data.valid) {
          sessionStorage.removeItem(TOKEN_KEY);
          sessionStorage.removeItem(USER_KEY);
          setToken(null);
          setUsername(null);
        }
      })
      .catch(() => {
        // server unreachable — keep token, will fail on next API call
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={{ token, username, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
