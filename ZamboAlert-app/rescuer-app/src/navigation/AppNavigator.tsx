import React from "react";
import { View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { AuthContainer } from "../screens/Auth";
import { MainTabNavigator } from "./MainTabNavigator";
import { SessionTimeoutOverlay } from "../components/SessionComponents";

export function AppNavigator() {
  const { currentUser, currentSession, login, logout, resetSessionTimer } = useAuth();
  const toast = useToast();

  return (
    <View style={{ flex: 1 }} onTouchStart={resetSessionTimer}>
      {currentUser && currentSession ? (
        <MainTabNavigator />
      ) : (
        <AuthContainer
          onLoginSuccess={login}
          toast={toast}
        />
      )}

      {currentSession && currentUser && (
        <SessionTimeoutOverlay
          expiresAt={currentSession.expiresAt}
          onRenew={resetSessionTimer}
          onExpire={() => logout("Session expired due to inactivity.")}
        />
      )}
    </View>
  );
}
