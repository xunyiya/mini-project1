import type { AuthMe } from "@collab/shared";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { apiClient, setAccessToken } from "./api";

const TOKEN_KEY = "collab_demo_token";

type AuthContextValue = {
  me: AuthMe | null;
  token: string | null;
  loading: boolean;
  login: (departmentId: string, login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [me, setMe] = useState<AuthMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAccessToken(token);
  }, [token]);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setMe(null);
    setAccessToken(null);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const currentUser = await apiClient.me();
      setMe(currentUser);
    } catch {
      clearSession();
    } finally {
      setLoading(false);
    }
  }, [clearSession, token]);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const login = useCallback(async (departmentId: string, loginName: string, password: string) => {
    const result = await apiClient.login(departmentId, loginName, password);
    localStorage.setItem(TOKEN_KEY, result.token);
    setAccessToken(result.token);
    setToken(result.token);
    setMe(result.me);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await apiClient.logout();
      }
    } finally {
      clearSession();
    }
  }, [clearSession, token]);

  const value = useMemo(
    () => ({
      me,
      token,
      loading,
      login,
      logout,
      refreshMe
    }),
    [loading, login, logout, me, refreshMe, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
