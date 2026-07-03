import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
  Linking,
} from "react-native";
import { ShieldCheck, X } from "lucide-react-native";

import { sha256 } from '../utils/crypto';
import { UserRecord, SessionDetails, MOCK_USERS_DATABASE } from '../utils/authData';
import { checkPasswordPolicy } from '../utils/password';

import { styles } from './Auth.styles';

// Sub-screen imports
import { LoginScreen } from "./auth/LoginScreen";
import { RegisterScreen } from "./auth/RegisterScreen";
import { EmailVerifyScreen } from "./auth/EmailVerifyScreen";
import { MfaVerifyScreen } from "./auth/MfaVerifyScreen";
import { ForgotPasswordScreen } from "./auth/ForgotPasswordScreen";

interface AuthContainerProps {
  onLoginSuccess: (user: UserRecord, session: SessionDetails) => void;
  toast: {
    success: (title: string, options?: { description?: string }) => void;
    info: (title: string, options?: { description?: string }) => void;
    error: (title: string, options?: { description?: string }) => void;
  };
}

type AuthScreen = "LOGIN" | "REGISTER" | "EMAIL_VERIFY" | "MFA_VERIFY" | "FORGOT_PASSWORD";

const LOCKOUT_DURATION_MS = 30_000;
const MAX_FAILED_ATTEMPTS = 3;

const createOfflineSession = (user: UserRecord): SessionDetails => ({
  id: `offline-${user.username}-${Date.now()}`,
  loginTime: Date.now(),
  deviceInfo: `${Platform.OS === "ios" ? "iOS" : "Android"} (offline)`,
  ipAddress: "127.0.0.1",
  token: `offline-${Math.random().toString(36).slice(2)}`,
  expiresAt: Date.now() + 5 * 60 * 1000,
});

const clearLockoutIfNeeded = (user: UserRecord) => {
  if (user.lockoutUntil && user.lockoutUntil <= Date.now()) {
    user.lockoutUntil = undefined;
    user.failedAttempts = 0;
  }
};

const getUserByIdentifier = (identifier: string): UserRecord | undefined => {
  const cleanId = identifier.trim().toLowerCase();
  return MOCK_USERS_DATABASE.find(
    (u) => u.username.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId
  );
};

const isPasswordValid = (user: UserRecord, password: string) => user.passwordHash === sha256(password);

export const BACKEND_URL = "offline";

export function AuthContainer({ onLoginSuccess, toast }: AuthContainerProps) {
  const [screen, setScreen] = useState<AuthScreen>("LOGIN");
  const [loading, setLoading] = useState(false);

  // Form inputs
  const [usernameInput, setUsernameInput] = useState("");
  const [firstNameInput, setFirstNameInput] = useState("");
  const [lastNameInput, setLastNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Email verification screen state
  const [verifyEmail, setVerifyEmail] = useState("");
  const [verifyCode, setVerifyCode] = useState("");

  // MFA verification screen state
  const [mfaUser, setMfaUser] = useState<UserRecord | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  // Forgot password screen state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [emailMockBanner, setEmailMockBanner] = useState<string | null>(null);

  // Account Lockout State (live countdown helper)
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState<number>(0);
  const [lockedUser, setLockedUser] = useState<string | null>(null);

  // Password Policy Analysis
  const passwordStats = checkPasswordPolicy(passwordInput);
  const newPasswordStats = checkPasswordPolicy(newPassword);

  // Lockout Countdown Effect
  useEffect(() => {
    if (lockoutTimeLeft <= 0) return;
    const timer = setInterval(() => {
      setLockoutTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setLockedUser(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutTimeLeft]);

  // Check Lockout handler
  const handleCheckLockout = async (username: string) => {
    if (!username.trim()) {
      setLockoutTimeLeft(0);
      setLockedUser(null);
      return;
    }

    const user = getUserByIdentifier(username);
    if (!user) {
      setLockoutTimeLeft(0);
      setLockedUser(null);
      return;
    }

    clearLockoutIfNeeded(user);
    if (user.lockoutUntil && user.lockoutUntil > Date.now()) {
      setLockoutTimeLeft(Math.ceil((user.lockoutUntil - Date.now()) / 1000));
      setLockedUser(user.username);
    } else {
      setLockoutTimeLeft(0);
      setLockedUser(null);
    }
  };

  // Login handler
  const handleLogin = async () => {
    if (!usernameInput.trim() || !passwordInput) {
      toast.error("Missing credentials", { description: "Please enter your username/email and password." });
      return;
    }

    setLoading(true);

    const user = getUserByIdentifier(usernameInput);
    if (!user) {
      setLoading(false);
      toast.error("Authentication failed", { description: "No account found for that username or email." });
      return;
    }

    clearLockoutIfNeeded(user);
    if (user.lockoutUntil && user.lockoutUntil > Date.now()) {
      setLockoutTimeLeft(Math.ceil((user.lockoutUntil - Date.now()) / 1000));
      setLockedUser(user.username);
      setLoading(false);
      toast.error("Account locked", { description: "Too many failed attempts. Please try again shortly." });
      return;
    }

    if (!isPasswordValid(user, passwordInput)) {
      user.failedAttempts = (user.failedAttempts || 0) + 1;
      if (user.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
        setLockoutTimeLeft(Math.ceil(LOCKOUT_DURATION_MS / 1000));
        setLockedUser(user.username);
        setLoading(false);
        toast.error("Account locked", { description: `Too many failed attempts. Try again in ${Math.ceil(LOCKOUT_DURATION_MS / 1000)} seconds.` });
      } else {
        setLoading(false);
        toast.error("Authentication failed", { description: `${MAX_FAILED_ATTEMPTS - user.failedAttempts} attempts remaining before lockout.` });
      }
      return;
    }

    user.failedAttempts = 0;
    user.lockoutUntil = undefined;
    setLoading(false);
    if (!user.isVerified) {
      setVerifyEmail(user.email);
      setScreen("EMAIL_VERIFY");
      toast.info("Verification needed", { description: "Please verify your email to log in." });
      return;
    }

    if (user.mfaEnabled) {
      setMfaUser(user);
      setScreen("MFA_VERIFY");
      toast.info("MFA required", { description: "Enter the code from your authenticator to continue." });
      return;
    }

    toast.success("Welcome back!", { description: `Signed in locally as ${user.username}` });
    onLoginSuccess(user, createOfflineSession(user));
  };

  // MFA verification handler
  const handleVerifyMfa = async () => {
    if (!mfaUser) return;
    if (!mfaCode.trim() || mfaCode.trim().length < 6) {
      toast.error("Verification failed", { description: "Please enter the 6-digit MFA code." });
      return;
    }

    setLoading(false);
    toast.success("Welcome back!", { description: `Signed in locally as ${mfaUser.username}` });
    onLoginSuccess(mfaUser, createOfflineSession(mfaUser));
  };

  // Registration handler
  const handleRegister = async () => {
    const fullName = `${firstNameInput.trim()} ${lastNameInput.trim()}`;

    if (!firstNameInput.trim() || !lastNameInput.trim() || !emailInput.trim() || !passwordInput) {
      toast.error("Missing fields", { description: "Please fill out all fields." });
      return;
    }

    if (passwordStats.score < 4) {
      toast.error("Weak password", { description: "Password must meet at least 4 criteria of the Strong Password Policy." });
      return;
    }

    if (getUserByIdentifier(fullName) || MOCK_USERS_DATABASE.some((u) => u.email.toLowerCase() === emailInput.trim().toLowerCase())) {
      toast.error("Account exists", { description: "That username or email is already registered locally." });
      return;
    }

    setLoading(true);

    const newUser: UserRecord = {
      username: fullName,
      email: emailInput.trim(),
      passwordHash: sha256(passwordInput),
      isVerified: true,
      mfaEnabled: false,
      mfaSecret: "",
      failedAttempts: 0,
    };

    MOCK_USERS_DATABASE.push(newUser);
    setLoading(false);
    setScreen("LOGIN");
    setFirstNameInput("");
    setLastNameInput("");
    setEmailInput("");
    setPasswordInput("");
    toast.success("Account created!", { description: "You can sign in now using the offline local account." });
  };

  // Email verification handler
  const handleVerifyEmail = async () => {
    if (!verifyCode.trim() || verifyCode.trim().length < 6) {
      toast.error("Verification failed", { description: "Please enter the 6-digit code." });
      return;
    }

    const user = MOCK_USERS_DATABASE.find((u) => u.email.toLowerCase() === verifyEmail.trim().toLowerCase());
    if (user) {
      user.isVerified = true;
    }

    setLoading(false);
    toast.success("Email verified!", { description: "Your account is now active. You may log in." });
    setScreen("LOGIN");
    setPasswordInput("");
    setVerifyCode("");
  };

  // Email verification code resend helper:
  const handleResendCode = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/resend-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verifyEmail }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.info("Code resent", { description: "A new 6-digit code has been dispatched." });
      } else {
        toast.error("Error", { description: data.message || "Could not resend verification code." });
      }
    } catch (err) {
      toast.error("Connection Error", { description: "Could not connect to the security server." });
    }
  };

  // Forgot password code request handler
  const handleForgotRequest = async () => {
    if (!forgotEmail.trim()) {
      toast.error("Email required", { description: "Please enter your registered email address." });
      return;
    }

    const user = MOCK_USERS_DATABASE.find((u) => u.email.toLowerCase() === forgotEmail.trim().toLowerCase());
    if (!user) {
      toast.error("Error", { description: "No account found for that email." });
      return;
    }

    setForgotStep(2);
    setLoading(false);
    toast.success("Code sent!", { description: "Recovery mode is available locally without a backend." });
  };

  // Forgot password reset action
  const handleForgotReset = async () => {
    if (newPasswordStats.score < 4) {
      toast.error("Weak password", { description: "New password must meet the Strong Password Policy." });
      return;
    }

    const user = MOCK_USERS_DATABASE.find((u) => u.email.toLowerCase() === forgotEmail.trim().toLowerCase());
    if (!user) {
      toast.error("Reset failed", { description: "No account found for that email." });
      return;
    }

    user.passwordHash = sha256(newPassword);
    setLoading(false);
    toast.success("Password reset!", { description: "You can now log in with your new password." });
    setForgotEmail("");
    setForgotCode("");
    setNewPassword("");
    setForgotStep(1);
    setScreen("LOGIN");
  };

  // Clean-up handler when returning to Login from Forgot Password
  const handleNavigateToLoginFromForgot = () => {
    setEmailMockBanner(null);
    setForgotStep(1);
    setForgotEmail("");
    setForgotCode("");
    setNewPassword("");
    setScreen("LOGIN");
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.authCard}>
        {emailMockBanner && (
          <View style={styles.bannerContainer}>
            <TouchableOpacity 
              style={{ flex: 1 }} 
              onPress={() => Linking.openURL(emailMockBanner).catch(() => {})}
            >
              <Text style={[styles.bannerText, { textDecorationLine: "underline" }]} numberOfLines={2}>
                [DEV EMAIL] Click to view simulated inbox: {emailMockBanner}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEmailMockBanner(null)} style={styles.bannerCloseBtn}>
              <X size={14} color="#dc2626" />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.cardHeader}>
          <ShieldCheck size={36} color="#dc2626" strokeWidth={2} />
          <Text style={styles.headerTitle}>ZamboAlert</Text>
          <Text style={styles.headerSubtitle}>
            {screen === "LOGIN" && "Enter credentials to access the rescuer mesh network"}
            {screen === "REGISTER" && "Establish secure rescuer node profile"}
            {screen === "EMAIL_VERIFY" && "Verify email address via 6-digit transmission code"}
            {screen === "MFA_VERIFY" && "Verify multi-factor session authenticator token"}
            {screen === "FORGOT_PASSWORD" && "Recover locked or forgotten credentials securely"}
          </Text>
        </View>

        {/* Render child sub-screens based on state */}
        {screen === "LOGIN" && (
          <LoginScreen
            usernameInput={usernameInput}
            setUsernameInput={setUsernameInput}
            passwordInput={passwordInput}
            setPasswordInput={setPasswordInput}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            lockoutTimeLeft={lockoutTimeLeft}
            handleCheckLockout={handleCheckLockout}
            handleLogin={handleLogin}
            loading={loading}
            onNavigateToRegister={() => {
              setScreen("REGISTER");
              setPasswordInput("");
            }}
            onNavigateToForgotPassword={() => setScreen("FORGOT_PASSWORD")}
          />
        )}

        {screen === "REGISTER" && (
          <RegisterScreen
            firstNameInput={firstNameInput}
            setFirstNameInput={setFirstNameInput}
            lastNameInput={lastNameInput}
            setLastNameInput={setLastNameInput}
            emailInput={emailInput}
            setEmailInput={setEmailInput}
            passwordInput={passwordInput}
            setPasswordInput={setPasswordInput}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            passwordStats={passwordStats}
            handleRegister={handleRegister}
            loading={loading}
            onNavigateToLogin={() => {
              setScreen("LOGIN");
              setPasswordInput("");
            }}
          />
        )}

        {screen === "EMAIL_VERIFY" && (
          <EmailVerifyScreen
            verifyEmail={verifyEmail}
            verifyCode={verifyCode}
            setVerifyCode={setVerifyCode}
            handleVerifyEmail={handleVerifyEmail}
            handleResendCode={handleResendCode}
            loading={loading}
            onNavigateToLogin={() => {
              setEmailMockBanner(null);
              setScreen("LOGIN");
            }}
          />
        )}

        {screen === "MFA_VERIFY" && (
          <MfaVerifyScreen
            mfaCode={mfaCode}
            setMfaCode={setMfaCode}
            handleVerifyMfa={handleVerifyMfa}
            onNavigateToLogin={() => {
              setEmailMockBanner(null);
              setScreen("LOGIN");
            }}
          />
        )}

        {screen === "FORGOT_PASSWORD" && (
          <ForgotPasswordScreen
            forgotEmail={forgotEmail}
            setForgotEmail={setForgotEmail}
            forgotCode={forgotCode}
            setForgotCode={setForgotCode}
            forgotStep={forgotStep}
            setForgotStep={setForgotStep}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            showNewPassword={showNewPassword}
            setShowNewPassword={setShowNewPassword}
            newPasswordStats={newPasswordStats}
            handleForgotRequest={handleForgotRequest}
            handleForgotReset={handleForgotReset}
            loading={loading}
            onNavigateToLogin={handleNavigateToLoginFromForgot}
          />
        )}
      </View>
    </ScrollView>
  );
}
