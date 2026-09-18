import { useCallback, useEffect, useState } from "react";

type User = { email: string; name: string; role: "admin" };

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({ user: null }));
      setUser(res.ok ? data.user ?? null : null);
      setError(null);
      return data;
    } catch (e) {
      setUser(null);
      setError(e instanceof Error ? e : new Error("Unable to check session"));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Sign in failed");
    setUser(data.user);
    return data.user as User;
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
    setUser(null);
  }, []);

  return { user, loading, error, isAuthenticated: Boolean(user), refresh, login, logout };
}
