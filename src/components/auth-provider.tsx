"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";

export interface LocalUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  user: LocalUser | null;
  role: string | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  isLoading: true,
  signOut: async () => { },
  refreshAuth: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          setRole(data.user.role);
        } else {
          setUser(null);
          setRole(null);
        }
      }
    } catch (e) {
      console.error("[Auth] Error fetching session:", e);
      setUser(null);
      setRole(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAuth();
  }, []);

  const signOut = async () => {
    setIsLoading(true);
    await signOutAction();
    setUser(null);
    setRole(null);
    setIsLoading(false);
    router.push('/login');
    router.refresh();
  };

  return (
    <AuthContext.Provider value={{ user, role, isLoading, signOut, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}