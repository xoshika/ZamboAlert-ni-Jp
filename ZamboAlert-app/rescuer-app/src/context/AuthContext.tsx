import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { UserRecord, SessionDetails, saveUser } from "../utils/authData";
import { initDatabase } from "../utils/database";
import { useToast } from "./ToastContext";

interface AuthContextType {
  currentUser: UserRecord | null;
  currentSession: SessionDetails | null;
  login: (user: UserRecord, session: SessionDetails) => void;
  logout: (message?: string) => void;
  updateUser: (updates: Partial<UserRecord>) => Promise<void>;
  resetSessionTimer: () => void;
  isDbInitialized: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [currentSession, setCurrentSession] = useState<SessionDetails | null>(null);
  const [isDbInitialized, setIsDbInitialized] = useState(false);
  const toast = useToast();

  useEffect(() => {
    initDatabase()
      .then(() => {
        console.log("Offline DB Initialized");
        setIsDbInitialized(true);
      })
      .catch((e) => {
        console.error("Failed to initialize offline DB:", e);
      });
  }, []);

  const login = useCallback((user: UserRecord, session: SessionDetails) => {
    setCurrentUser(user);
    setCurrentSession(session);
  }, []);

  const logout = useCallback((message?: string) => {
    setCurrentUser(null);
    setCurrentSession(null);
    if (message) {
      toast.info("Session Closed", { description: message });
    } else {
      toast.info("Logged Out", { description: "You have been securely logged out." });
    }
  }, [toast]);

  const updateUser = useCallback(async (updates: Partial<UserRecord>) => {
    if (currentUser) {
      const updated = { ...currentUser, ...updates };
      setCurrentUser(updated);
      await saveUser(updated);
      toast.info("Offline Sync", { description: "Updated profile locally." });
    }
  }, [currentUser, toast]);

  const resetSessionTimer = useCallback(() => {
    if (currentSession && currentUser) {
      currentSession.expiresAt = Date.now() + 5 * 60 * 1000;
    }
  }, [currentSession, currentUser]);

  // Session Inactivity Monitoring
  useEffect(() => {
    if (!currentSession || !currentUser) return;

    const checkInterval = setInterval(() => {
      if (Date.now() > currentSession.expiresAt) {
        clearInterval(checkInterval);
        logout("Session expired due to inactivity.");
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [currentSession, currentUser, logout]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentSession,
        login,
        logout,
        updateUser,
        resetSessionTimer,
        isDbInitialized,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
