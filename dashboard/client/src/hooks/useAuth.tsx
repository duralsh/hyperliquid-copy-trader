import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import {
  apiLogin,
  apiRegister,
  apiGetMe,
  apiRegisterAgent,
  apiCompleteOnboarding,
  type AuthUser,
} from "../services/api.js";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  registerAgent: (
    privateKey: string,
    agentName: string,
    agentHandle: string,
  ) => Promise<{
    agentId: string;
    apiKey: string;
    verificationCode: string;
    walletAddress: string;
  }>;
  completeOnboarding: (
    privateKey: string,
    arenaApiKey: string,
  ) => Promise<{ walletAddress: string }>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem("hl-auth-token"),
  );
  const [isLoading, setIsLoading] = useState(!!localStorage.getItem("hl-auth-token"));

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    apiGetMe()
      .then(({ user }) => setUser(user))
      .catch(() => {
        localStorage.removeItem("hl-auth-token");
        setToken(null);
      })
      .finally(() => setIsLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (username: string, password: string) => {
    const { token: t, user: u } = await apiLogin(username, password);
    localStorage.setItem("hl-auth-token", t);
    setToken(t);
    setUser(u);
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const { token: t, user: u } = await apiRegister(username, password);
    localStorage.setItem("hl-auth-token", t);
    setToken(t);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("hl-auth-token");
    setToken(null);
    setUser(null);
    window.location.reload();
  }, []);

  const registerAgentFn = useCallback(
    async (privateKey: string, agentName: string, agentHandle: string) => {
      return apiRegisterAgent(privateKey, agentName, agentHandle);
    },
    [],
  );

  const completeOnboardingFn = useCallback(
    async (privateKey: string, arenaApiKey: string) => {
      const { user: u, walletAddress } = await apiCompleteOnboarding(privateKey, arenaApiKey);
      setUser(u);
      return { walletAddress };
    },
    [],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        registerAgent: registerAgentFn,
        completeOnboarding: completeOnboardingFn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
