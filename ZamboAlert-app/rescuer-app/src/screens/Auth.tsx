import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
  Linking,
} from "react-native";
import Constants from "expo-constants";
import { ShieldCheck, X } from "lucide-react-native";
import { auth } from '../utils/firebaseConfig';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, updateProfile } from 'firebase/auth';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

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

const getBackendUrl = () => {
  if (EXPO_PUBLIC_BACKEND_URL) {
    return EXPO_PUBLIC_BACKEND_URL;
  }

  if (Constants.expoConfig?.hostUri) {
    const host = Constants.expoConfig.hostUri.split(":").shift();
    return `http://${host}:5000`;
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:5000";
  }

  return "http://localhost:5000";
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "Unknown error";
};

const parseJsonResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

export const BACKEND_URL = getBackendUrl();
export const DEFAULT_FETCH_TIMEOUT_MS = 25_000;

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

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

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/lockout-status/${encodeURIComponent(username)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.locked) {
          setLockoutTimeLeft(data.timeLeft);
          setLockedUser(data.username);
        } else {
          setLockoutTimeLeft(0);
          setLockedUser(null);
        }
      }
    } catch (err) {
      console.warn("Could not check lockout status from backend");
    }
  };

  // Login handler
  const handleLogin = async () => {
    if (!usernameInput.trim() || !passwordInput) {
      toast.error("Missing credentials", { description: "Please enter your email and password." });
      return;
    }

    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, usernameInput.trim(), passwordInput);
      const user = userCredential.user;
      
      const idToken = await user.getIdToken(true);

      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          deviceInfo: `${Platform.OS === "ios" ? "iOS" : "Android"} Rescuer Node`,
        }),
      });

      const data = await response.json();

      if (response.status === 202) {
        // Verification or MFA required
        if (data.status === "VERIFICATION_REQUIRED") {
          setVerifyEmail(user.email || usernameInput.trim());
          setScreen("EMAIL_VERIFY");
          toast.info("Verification needed", { description: data.message });
        } else if (data.status === "MFA_REQUIRED") {
          setMfaCode("");
          setMfaUser({
            username: data.username,
            email: "",
            passwordHash: "",
            isVerified: true,
            mfaEnabled: true,
            mfaSecret: "",
            failedAttempts: 0,
          });
          setScreen("MFA_VERIFY");
          toast.info("MFA required", { description: data.message });
        }
      } else if (response.status === 423) {
        // Locked
        setLockoutTimeLeft(data.timeLeft || 30);
        setLockedUser(usernameInput);
        toast.error("Account locked", { description: data.message || "Too many failed attempts." });
      } else if (!response.ok) {
        // Auth failed or other error
        toast.error("Authentication failed", { description: data.error || data.message || "Invalid credentials." });
      } else {
        // Success
        toast.success("Welcome back!", { description: `Signed in as ${data.user.username}` });
        onLoginSuccess(data.user, data.session);
      }
    } catch (err: any) {
      const errorMsg = err.code || err.message || "Could not connect to the security server.";
      toast.error("Authentication Error", { description: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  // MFA verification handler
  const handleVerifyMfa = async () => {
    if (!mfaUser) return;
    if (!mfaCode.trim() || mfaCode.trim().length < 6) {
      toast.error("Verification failed", { description: "Please enter the 6-digit MFA code." });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/verify-mfa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: mfaUser.username,
          code: mfaCode.trim(),
          deviceInfo: `${Platform.OS === "ios" ? "iOS" : "Android"} Rescuer Node`,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Welcome back!", { description: `Signed in as ${data.user.username}` });
        onLoginSuccess(data.user, data.session);
      } else {
        toast.error("Verification failed", { description: data.error || "Invalid authenticator code." });
      }
    } catch (err) {
      toast.error("Connection Error", { description: "Could not verify MFA code." });
    } finally {
      setLoading(false);
    }
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

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, emailInput.trim(), passwordInput);
      const user = userCredential.user;
      
      await updateProfile(user, { displayName: fullName });
      await sendEmailVerification(user);

      toast.success("Account created!", { description: "Please check your inbox to verify your email." });
      setVerifyEmail(emailInput.trim());
      setScreen("EMAIL_VERIFY");
      setFirstNameInput("");
      setLastNameInput("");
      setEmailInput("");
      setPasswordInput("");
    } catch (err: any) {
      console.error("Registration request failed", err);
      toast.error("Registration Error", { description: err.message || "Could not register rescuer profile." });
    } finally {
      setLoading(false);
    }
  };

  // Email verification handler
  const handleVerifyEmail = async () => {
    setLoading(true);
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          toast.success("Email verified!", { description: "Your account is now active. You may log in." });
          setScreen("LOGIN");
          setPasswordInput("");
          setVerifyCode("");
        } else {
          toast.error("Not verified", { description: "Your email is still not verified. Please check your inbox and click the link." });
        }
      } else {
        toast.error("Error", { description: "You are not logged in. Please try logging in first to check verification status." });
      }
    } catch (err) {
      toast.error("Connection Error", { description: "Could not verify email status." });
    } finally {
      setLoading(false);
    }
  };

  // Email verification code resend helper:
  const handleResendCode = async () => {
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        toast.info("Email resent", { description: "A new verification link has been dispatched." });
      } else {
        toast.error("Error", { description: "You must be logged in to resend the code." });
      }
    } catch (err: any) {
      toast.error("Error", { description: err.message || "Could not resend verification email." });
    }
  };

  // Forgot password link request handler
  const handleForgotRequest = async () => {
    if (!forgotEmail.trim()) {
      toast.error("Email required", { description: "Please enter your registered email address." });
      return;
    }

    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, forgotEmail.trim());
      toast.success("Link sent!", { description: "Please check your inbox for the password reset link." });
      // User will reset password on the Firebase web UI, so we can send them back to login
      handleNavigateToLoginFromForgot();
    } catch (err: any) {
      toast.error("Error", { description: err.message || "Could not request password reset." });
    } finally {
      setLoading(false);
    }
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
            loading={loading}
            onNavigateToLogin={() => {
              setEmailMockBanner(null);
              setMfaCode("");
              setMfaUser(null);
              setScreen("LOGIN");
            }}
          />
        )}

        {screen === "FORGOT_PASSWORD" && (
          <ForgotPasswordScreen
            forgotEmail={forgotEmail}
            setForgotEmail={setForgotEmail}
            handleForgotRequest={handleForgotRequest}
            loading={loading}
            onNavigateToLogin={handleNavigateToLoginFromForgot}
          />
        )}
      </View>
    </ScrollView>
  );
}
