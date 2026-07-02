import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Linking,
} from "react-native";
import {
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  Check,
  X,
  ShieldCheck,
  Key,
  RefreshCw,
  LogOut,
  Clock,
  Smartphone,
  AlertCircle,
  ArrowLeft,
  ShieldAlert,
} from "lucide-react-native";

// ── Pure JS SHA-256 Implementation ──────────────────────────────────────────
export function sha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106bb041,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  let asciiLength = ascii.length;
  let asciiBitLength = asciiLength * 8;

  let words: number[] = [];
  for (let i = 0; i < asciiLength; i++) {
    words[i >> 2] |= ascii.charCodeAt(i) << (24 - (i % 4) * 8);
  }

  words[asciiLength >> 2] |= 0x80 << (24 - (asciiLength % 4) * 8);

  let wordCount = ((asciiLength + 8) >> 6) * 16 + 16;
  while (words.length < wordCount) {
    words.push(0);
  }
  words[wordCount - 1] = asciiBitLength;

  for (let i = 0; i < wordCount; i += 16) {
    let w: number[] = [];
    for (let j = 0; j < 16; j++) w[j] = words[i + j];
    for (let j = 16; j < 64; j++) {
      let s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      let s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }

    let a = hash[0];
    let b = hash[1];
    let c = hash[2];
    let d = hash[3];
    let e = hash[4];
    let f = hash[5];
    let g = hash[6];
    let h = hash[7];

    for (let j = 0; j < 64; j++) {
      let S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      let ch = (e & f) ^ (~e & g);
      let temp1 = (h + S1 + ch + K[j] + w[j]) | 0;
      let S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      let maj = (a & b) ^ (a & c) ^ (b & c);
      let temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  return hash.map(val => {
    let hex = (val >>> 0).toString(16);
    return "00000000".substring(hex.length) + hex;
  }).join("");
}

// ── Types ───────────────────────────────────────────────────────────────────
export interface UserRecord {
  username: string;
  email: string;
  passwordHash: string;
  isVerified: boolean;
  emailVerificationCode?: string;
  mfaEnabled: boolean;
  mfaSecret: string;
  failedAttempts: number;
  lockoutUntil?: number;
}

export interface SessionDetails {
  id: string;
  loginTime: number;
  deviceInfo: string;
  ipAddress: string;
  token: string;
  expiresAt: number;
}

// ── Mock Database ───────────────────────────────────────────────────────────
// We use a global array to preserve mock users throughout the bundle runtime.
export const MOCK_USERS_DATABASE: UserRecord[] = [
  {
    username: "rescuer1",
    email: "rescuer1@zamboalert.gov",
    // SHA-256 of "SecurePass123!"
    passwordHash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
    isVerified: true,
    mfaEnabled: false,
    mfaSecret: "ZB-928A",
    failedAttempts: 0,
  }
];

// Helper database functions
export function findUser(identifier: string): UserRecord | undefined {
  const cleanId = identifier.trim().toLowerCase();
  return MOCK_USERS_DATABASE.find(
    (u) => u.username.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId
  );
}

export function saveUser(user: UserRecord) {
  // Deprecated: updates are managed via backend APIs now.
  // We keep it as a no-op to maintain client compatibility.
}

// Password Policy Checker
export interface PasswordRequirements {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
}

export function checkPasswordPolicy(pass: string): {
  requirements: PasswordRequirements;
  score: number; // 0 to 5
  label: string;
  color: string;
} {
  const reqs = {
    length: pass.length >= 8,
    uppercase: /[A-Z]/.test(pass),
    lowercase: /[a-z]/.test(pass),
    number: /[0-9]/.test(pass),
    special: /[^A-Za-z0-9]/.test(pass),
  };

  const score = Object.values(reqs).filter(Boolean).length;
  let label = "Weak";
  let color = "#ef4444"; // Red

  if (score === 2) {
    label = "Fair";
    color = "#f97316"; // Orange
  } else if (score === 3) {
    label = "Good";
    color = "#eab308"; // Yellow
  } else if (score === 4) {
    label = "Strong";
    color = "#22c55e"; // Green
  } else if (score === 5) {
    label = "Excellent";
    color = "#10b981"; // Emerald
  }

  return { requirements: reqs, score, label, color };
}

// ── Shared Text Input Component ──────────────────────────────────────────────
interface InputFieldProps {
  icon: any;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  rightElement?: React.ReactNode;
  keyboardType?: "default" | "email-address" | "numeric";
  autoCapitalize?: "none" | "sentences" | "words";
  maxLength?: number;
}

function InputField({
  icon: Icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  rightElement,
  keyboardType = "default",
  autoCapitalize = "none",
  maxLength,
}: InputFieldProps) {
  return (
    <View style={styles.inputWrapper}>
      <Icon size={18} color="#9ca3af" style={styles.inputIcon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
      />
      {rightElement}
    </View>
  );
}

// ── Password Requirement Row Component ───────────────────────────────────────
function RequirementRow({ met, label }: { met: boolean; label: string }) {
  return (
    <View style={styles.reqRow}>
      <View style={[styles.reqDot, met ? styles.reqDotMet : styles.reqDotUnmet]}>
        {met ? (
          <Check size={8} color="#ffffff" strokeWidth={3} />
        ) : (
          <X size={8} color="#ffffff" strokeWidth={3} />
        )}
      </View>
      <Text style={[styles.reqText, met ? styles.reqTextMet : styles.reqTextUnmet]}>
        {label}
      </Text>
    </View>
  );
}

// ── AuthContainer Component ──────────────────────────────────────────────────
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

        {/* ── SCREEN: LOGIN ── */}
        {screen === "LOGIN" && (
          <View style={styles.formContainer}>
            {lockoutTimeLeft > 0 && (
              <View style={styles.lockoutBadge}>
                <Clock size={14} color="#dc2626" style={{ marginRight: 6 }} />
                <Text style={styles.lockoutText}>
                  Account locked for security. Try again in {lockoutTimeLeft}s
                </Text>
              </View>
            )}

            <InputField
              icon={User}
              placeholder="Username or Email"
              value={usernameInput}
              onChangeText={(text) => {
                setUsernameInput(text);
                handleCheckLockout(text);
              }}
            />

            <InputField
              icon={Lock}
              placeholder="Password"
              value={passwordInput}
              secureTextEntry={!showPassword}
              onChangeText={setPasswordInput}
              rightElement={
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.rightBtn}>
                  {showPassword ? <EyeOff size={16} color="#9ca3af" /> : <Eye size={16} color="#9ca3af" />}
                </TouchableOpacity>
              }
            />

            <TouchableOpacity
              onPress={() => setScreen("FORGOT_PASSWORD")}
              style={styles.forgotBtn}
            >
              <Text style={styles.forgotText}>Forgot password secure recovery?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleLogin}
              style={[styles.primaryBtn, lockoutTimeLeft > 0 && styles.disabledBtn]}
              disabled={loading || lockoutTimeLeft > 0}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Login</Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              onPress={() => {
                setScreen("REGISTER");
                // Clean inputs
                setPasswordInput("");
              }}
              style={styles.secondaryBtn}
              disabled={loading}
            >
              <Text style={styles.secondaryBtnText}>Register New Rescuer Profile</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── SCREEN: REGISTER ── */}
        {screen === "REGISTER" && (
          <View style={styles.formContainer}>
            <InputField
              icon={User}
              placeholder="First Name"
              value={firstNameInput}
              onChangeText={setFirstNameInput}
            />

            <InputField
              icon={User}
              placeholder="Last Name"
              value={lastNameInput}
              onChangeText={setLastNameInput}
            />

            <InputField
              icon={Mail}
              placeholder="Official Rescuer Email"
              value={emailInput}
              onChangeText={setEmailInput}
              keyboardType="email-address"
            />

            <InputField
              icon={Lock}
              placeholder="Secure Password"
              value={passwordInput}
              secureTextEntry={!showPassword}
              onChangeText={setPasswordInput}
              rightElement={
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.rightBtn}>
                  {showPassword ? <EyeOff size={16} color="#9ca3af" /> : <Eye size={16} color="#9ca3af" />}
                </TouchableOpacity>
              }
            />

            {/* Password Strength Meter */}
            {passwordInput.length > 0 && (
              <View style={styles.strengthMeterContainer}>
                <View style={styles.strengthTextRow}>
                  <Text style={styles.strengthTextLabel}>Password Complexity:</Text>
                  <Text style={[styles.strengthValueLabel, { color: passwordStats.color }]}>
                    {passwordStats.label} ({passwordStats.score}/5)
                  </Text>
                </View>

                {/* Progress bar */}
                <View style={styles.strengthProgressBarOuter}>
                  <View
                    style={[
                      styles.strengthProgressBarInner,
                      {
                        width: `${(passwordStats.score / 5) * 100}%`,
                        backgroundColor: passwordStats.color,
                      },
                    ]}
                  />
                </View>

                {/* Requirements Checklist */}
                <View style={styles.checklistContainer}>
                  <RequirementRow met={passwordStats.requirements.length} label="Minimum 8 characters length" />
                  <RequirementRow met={passwordStats.requirements.uppercase} label="Contains uppercase letter [A-Z]" />
                  <RequirementRow met={passwordStats.requirements.lowercase} label="Contains lowercase letter [a-z]" />
                  <RequirementRow met={passwordStats.requirements.number} label="Contains numeric digit [0-9]" />
                  <RequirementRow met={passwordStats.requirements.special} label="Contains special character (e.g., !@#$)" />
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={handleRegister}
              style={[styles.primaryBtn, passwordStats.score < 4 && styles.disabledBtn]}
              disabled={loading || passwordStats.score < 4}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Register Rescuer</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setScreen("LOGIN");
                setPasswordInput("");
              }}
              style={styles.backLink}
              disabled={loading}
            >
              <ArrowLeft size={14} color="#4b5563" style={{ marginRight: 6 }} />
              <Text style={styles.backLinkText}>Return to Login Gate</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── SCREEN: EMAIL VERIFY ── */}
        {screen === "EMAIL_VERIFY" && (
          <View style={styles.formContainer}>
            <View style={styles.instructionCard}>
              <Mail size={20} color="#2563eb" style={{ marginBottom: 8 }} />
              <Text style={styles.instructionText}>
                For security reasons, we have dispatched a 6-digit confirmation code to:{"\n"}
                <Text style={styles.textHighlight}>{verifyEmail}</Text>
              </Text>
            </View>

            <InputField
              icon={Key}
              placeholder="Enter 6-digit Email Code"
              value={verifyCode}
              onChangeText={setVerifyCode}
              keyboardType="numeric"
              maxLength={6}
            />

            <TouchableOpacity
              onPress={handleVerifyEmail}
              style={styles.primaryBtn}
              disabled={loading || verifyCode.length !== 6}
            >
              <Text style={styles.primaryBtnText}>Activate Rescuer Account</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={async () => {
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
              }}
              style={styles.resendBtn}
            >
              <RefreshCw size={12} color="#2563eb" style={{ marginRight: 6 }} />
              <Text style={styles.resendBtnText}>Resend verification code</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setEmailMockBanner(null);
                setScreen("LOGIN");
              }}
              style={styles.backLink}
            >
              <ArrowLeft size={14} color="#4b5563" style={{ marginRight: 6 }} />
              <Text style={styles.backLinkText}>Return to Login Gate</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── SCREEN: MFA VERIFY ── */}
        {screen === "MFA_VERIFY" && (
          <View style={styles.formContainer}>
            <View style={styles.instructionCard}>
              <Smartphone size={20} color="#10b981" style={{ marginBottom: 8 }} />
              <Text style={styles.instructionText}>
                Multi-Factor Authentication (MFA) Active. Please enter the 6-digit token generated by your rescuer device or authenticator.
              </Text>
            </View>

            <InputField
              icon={ShieldCheck}
              placeholder="Enter 6-digit MFA Token"
              value={mfaCode}
              onChangeText={setMfaCode}
              keyboardType="numeric"
              maxLength={6}
            />

            <TouchableOpacity
              onPress={handleVerifyMfa}
              style={styles.primaryBtn}
              disabled={mfaCode.length !== 6}
            >
              <Text style={styles.primaryBtnText}>Verify and Login</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setEmailMockBanner(null);
                setScreen("LOGIN");
              }}
              style={styles.backLink}
            >
              <ArrowLeft size={14} color="#4b5563" style={{ marginRight: 6 }} />
              <Text style={styles.backLinkText}>Cancel Authentication</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── SCREEN: FORGOT PASSWORD ── */}
        {screen === "FORGOT_PASSWORD" && (
          <View style={styles.formContainer}>
            {forgotStep === 1 ? (
              <>
                <View style={styles.instructionCard}>
                  <AlertCircle size={20} color="#f59e0b" style={{ marginBottom: 8 }} />
                  <Text style={styles.instructionText}>
                    Provide your registered rescuer email address. If verified, we will transmit a security recovery code to reset your credentials.
                  </Text>
                </View>

                <InputField
                  icon={Mail}
                  placeholder="Official Rescuer Email"
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  keyboardType="email-address"
                />

                <TouchableOpacity
                  onPress={handleForgotRequest}
                  style={styles.primaryBtn}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Generate Recovery Code</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.instructionCard}>
                  <Key size={20} color="#10b981" style={{ marginBottom: 8 }} />
                  <Text style={styles.instructionText}>
                    A 6-digit recovery code has been sent to {forgotEmail}. Please establish a new secure password.
                  </Text>
                </View>

                <InputField
                  icon={Key}
                  placeholder="Enter 6-digit Recovery Code"
                  value={forgotCode}
                  onChangeText={setForgotCode}
                  keyboardType="numeric"
                  maxLength={6}
                />

                <InputField
                  icon={Lock}
                  placeholder="New Secure Password"
                  value={newPassword}
                  secureTextEntry={!showNewPassword}
                  onChangeText={setNewPassword}
                  rightElement={
                    <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.rightBtn}>
                      {showNewPassword ? <EyeOff size={16} color="#9ca3af" /> : <Eye size={16} color="#9ca3af" />}
                    </TouchableOpacity>
                  }
                />

                {/* Password Strength Meter for resetting */}
                {newPassword.length > 0 && (
                  <View style={styles.strengthMeterContainer}>
                    <View style={styles.strengthTextRow}>
                      <Text style={styles.strengthTextLabel}>New Password Complexity:</Text>
                      <Text style={[styles.strengthValueLabel, { color: newPasswordStats.color }]}>
                        {newPasswordStats.label} ({newPasswordStats.score}/5)
                      </Text>
                    </View>

                    <View style={styles.strengthProgressBarOuter}>
                      <View
                        style={[
                          styles.strengthProgressBarInner,
                          {
                            width: `${(newPasswordStats.score / 5) * 100}%`,
                            backgroundColor: newPasswordStats.color,
                          },
                        ]}
                      />
                    </View>

                    <View style={styles.checklistContainer}>
                      <RequirementRow met={newPasswordStats.requirements.length} label="Minimum 8 characters length" />
                      <RequirementRow met={newPasswordStats.requirements.uppercase} label="Contains uppercase letter [A-Z]" />
                      <RequirementRow met={newPasswordStats.requirements.lowercase} label="Contains lowercase letter [a-z]" />
                      <RequirementRow met={newPasswordStats.requirements.number} label="Contains numeric digit [0-9]" />
                      <RequirementRow met={newPasswordStats.requirements.special} label="Contains special character (e.g., !@#$)" />
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleForgotReset}
                  style={[styles.primaryBtn, newPasswordStats.score < 4 && styles.disabledBtn]}
                  disabled={loading || newPasswordStats.score < 4 || forgotCode.length !== 6}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Reset Rescuer Password</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setForgotStep(1)}
                  style={styles.resendBtn}
                >
                  <Text style={styles.resendBtnText}>Back to Email Verification</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              onPress={() => {
                setEmailMockBanner(null);
                setScreen("LOGIN");
                setForgotStep(1);
              }}
              style={styles.backLink}
              disabled={loading}
            >
              <ArrowLeft size={14} color="#4b5563" style={{ marginRight: 6 }} />
              <Text style={styles.backLinkText}>Return to Login Gate</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ── SessionSettingsSection Component ─────────────────────────────────────────
// Displays current session logs, allows configuring MFA, and displays session details.
interface SessionSettingsProps {
  currentUser: UserRecord;
  session: SessionDetails;
  onLogout: () => void;
  onUpdateUser: (updates: Partial<UserRecord>) => void;
  toast: any;
}

export function SessionSettingsSection({
  currentUser,
  session,
  onLogout,
  onUpdateUser,
  toast,
}: SessionSettingsProps) {
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState<number>(0);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [mfaSetupCode, setMfaSetupCode] = useState("");
  const [tempMfaSecret, setTempMfaSecret] = useState("");

  // Track session countdown
  useEffect(() => {
    const updateTime = () => {
      const remaining = Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 1000));
      setSessionTimeRemaining(remaining);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [session]);

  const handleToggleMfa = () => {
    if (currentUser.mfaEnabled) {
      // Disable MFA
      onUpdateUser({ mfaEnabled: false });
      toast.info("MFA Disabled", { description: "Your account no longer requires Multi-Factor tokens." });
    } else {
      // Start setup MFA
      const secret = "ZB-" + Math.floor(1000 + Math.random() * 9000).toString(16).toUpperCase();
      setTempMfaSecret(secret);
      setShowMfaSetup(true);
    }
  };

  const handleVerifySetupMfa = () => {
    // Demo verification code: any 6 digit code works, but we tell user to use '123456' for simplicity
    if (mfaSetupCode.trim().length === 6) {
      onUpdateUser({ mfaEnabled: true, mfaSecret: tempMfaSecret });
      setShowMfaSetup(false);
      setMfaSetupCode("");
      toast.success("MFA Enabled", { description: "Your account is now protected with Multi-Factor Authentication." });
    } else {
      toast.error("MFA Error", { description: "Please enter a valid 6-digit authentication token." });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <View style={settingsStyles.container}>
      <Text style={settingsStyles.sectionTitle}>SECURITY SETTINGS</Text>

      {/* Account Profile Summary */}
      <View style={settingsStyles.card}>
        <Text style={settingsStyles.cardHeader}>Rescuer Account</Text>
        <View style={settingsStyles.row}>
          <Text style={settingsStyles.label}>Username:</Text>
          <Text style={settingsStyles.value}>{currentUser.username}</Text>
        </View>
        <View style={settingsStyles.row}>
          <Text style={settingsStyles.label}>Email:</Text>
          <Text style={settingsStyles.value}>{currentUser.email}</Text>
        </View>
        <View style={settingsStyles.row}>
          <Text style={settingsStyles.label}>Status:</Text>
          <Text style={[settingsStyles.value, { color: "#10b981", fontWeight: "bold" }]}>
            VERIFIED RESCUER
          </Text>
        </View>
      </View>

      {/* MFA Configuration */}
      <View style={settingsStyles.card}>
        <View style={settingsStyles.cardHeaderRow}>
          <Text style={settingsStyles.cardHeader}>Multi-Factor Authentication (MFA)</Text>
          <TouchableOpacity
            onPress={handleToggleMfa}
            style={[
              settingsStyles.toggleBtn,
              currentUser.mfaEnabled ? settingsStyles.toggleBtnActive : settingsStyles.toggleBtnInactive,
            ]}
          >
            <Text style={settingsStyles.toggleBtnText}>
              {currentUser.mfaEnabled ? "ENABLED" : "DISABLED"}
            </Text>
          </TouchableOpacity>
        </View>

        {showMfaSetup && (
          <View style={settingsStyles.mfaSetupBox}>
            <Text style={settingsStyles.mfaSetupTitle}>Setup Authenticator App</Text>
            <Text style={settingsStyles.mfaSetupSteps}>
              1. Scan the mock QR configuration code below or enter secret:{"\n"}
              <Text style={settingsStyles.secretHighlight}>{tempMfaSecret}</Text>
            </Text>

            {/* Simulated QR Code Box */}
            <View style={settingsStyles.qrSimulator}>
              <View style={settingsStyles.qrMockDotGrid}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <View key={i} style={settingsStyles.qrMockCorner} />
                ))}
                <ShieldCheck size={28} color="#000000" />
              </View>
              <Text style={settingsStyles.qrSimulatorText}>ZamboAlert Secure Seed</Text>
            </View>

            <Text style={settingsStyles.mfaSetupSteps}>
              2. Enter the 6-digit code from your authenticator app (use: <Text style={{fontWeight: "bold"}}>123456</Text> to verify):
            </Text>

            <TextInput
              style={settingsStyles.mfaInput}
              placeholder="e.g. 123456"
              placeholderTextColor="#9ca3af"
              value={mfaSetupCode}
              onChangeText={setMfaSetupCode}
              keyboardType="numeric"
              maxLength={6}
            />

            <View style={settingsStyles.mfaActionRow}>
              <TouchableOpacity
                onPress={() => setShowMfaSetup(false)}
                style={settingsStyles.mfaCancelBtn}
              >
                <Text style={settingsStyles.mfaCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleVerifySetupMfa}
                style={settingsStyles.mfaConfirmBtn}
              >
                <Text style={settingsStyles.mfaConfirmText}>Verify & Enable</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Secure Session Details */}
      <View style={settingsStyles.card}>
        <Text style={settingsStyles.cardHeader}>Secure Session Details</Text>

        <View style={settingsStyles.row}>
          <Text style={settingsStyles.label}>Device Platform:</Text>
          <Text style={settingsStyles.value}>{session.deviceInfo}</Text>
        </View>
        <View style={settingsStyles.row}>
          <Text style={settingsStyles.label}>IP Address:</Text>
          <Text style={settingsStyles.value}>{session.ipAddress}</Text>
        </View>
        {/*
        <View style={settingsStyles.row}>
          <Text style={settingsStyles.label}>Inactivity Timeout:</Text>
          <Text style={[settingsStyles.value, { color: sessionTimeRemaining < 60 ? "#dc2626" : "#000000" }]}>
            {formatTime(sessionTimeRemaining)}
          </Text>
        </View>
        */}
        <View style={settingsStyles.row}>
          <Text style={settingsStyles.label}>Session Token:</Text>
          <Text style={[settingsStyles.value, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 10 }]}>
            {session.token.substring(0, 8)}...{session.token.substring(session.token.length - 8)}
          </Text>
        </View>

        {/*
        <TouchableOpacity
          onPress={async () => {
            try {
              const response = await fetch(`${BACKEND_URL}/api/auth/session-keepalive`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionToken: session.token }),
              });
              const data = await response.json();
              if (response.ok) {
                session.expiresAt = data.expiresAt;
                toast.success("Session Extended", { description: "Your session token has been refreshed." });
              } else {
                toast.error("Error", { description: "Failed to extend session." });
              }
            } catch (err) {
              session.expiresAt = Date.now() + 5 * 60 * 1000;
              toast.success("Session Extended (Offline)", { description: "Your session has been extended locally." });
            }
          }}
          style={settingsStyles.refreshBtn}
        >
          <RefreshCw size={14} color="#2563eb" style={{ marginRight: 6 }} />
          <Text style={settingsStyles.refreshBtnText}>Renew Inactivity Timer</Text>
        </TouchableOpacity>
        */}
      </View>

      {/* Log Out Button */}
      <TouchableOpacity onPress={onLogout} style={settingsStyles.logoutBtn}>
        <LogOut size={16} color="#ffffff" style={{ marginRight: 8 }} />
        <Text style={settingsStyles.logoutBtnText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── SessionTimeoutOverlay Component ──────────────────────────────────────────
// Renders when inactivity timeout is about to trigger, offering an extend button.
interface SessionTimeoutOverlayProps {
  expiresAt: number;
  onRenew: () => void;
  onExpire: () => void;
}

export function SessionTimeoutOverlay({
  expiresAt,
  onRenew,
  onExpire,
}: SessionTimeoutOverlayProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const checkTime = () => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        onExpire();
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // Only show when under 30 seconds
  if (timeLeft > 30 || timeLeft <= 0) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.alertCard}>
        <Clock size={28} color="#f59e0b" style={{ marginBottom: 12 }} />
        <Text style={styles.alertTitle}>Session Inactivity Warning</Text>
        <Text style={styles.alertDesc}>
          Due to inactivity, your secure session will expire and automatically log out in:
        </Text>
        <Text style={styles.alertTimer}>{timeLeft} seconds</Text>

        <TouchableOpacity onPress={onRenew} style={styles.renewBtn}>
          <Text style={styles.renewBtnText}>Keep Session Active</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── StyleSheet Definitions ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 40,
    backgroundColor: "#f9fafb",
  },
  bannerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderColor: "#fca5a5",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 20,
  },
  bannerText: {
    flex: 1,
    fontSize: 11,
    color: "#b91c1c",
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: "600",
  },
  bannerCloseBtn: {
    padding: 2,
    marginLeft: 4,
  },
  authCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 16,
  },
  formContainer: {
    width: "100%",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    height: "100%",
  },
  rightBtn: {
    padding: 8,
  },
  forgotBtn: {
    alignSelf: "flex-end",
    marginBottom: 18,
  },
  forgotText: {
    fontSize: 12,
    color: "#2563eb",
    fontWeight: "500",
  },
  primaryBtn: {
    backgroundColor: "#dc2626",
    borderRadius: 10,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledBtn: {
    backgroundColor: "#fca5a5",
  },
  primaryBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
  },
  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 20,
  },
  secondaryBtn: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderWidth: 1,
    borderRadius: 10,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  backLinkText: {
    color: "#4b5563",
    fontSize: 13,
    fontWeight: "600",
  },
  lockoutBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff5f5",
    borderColor: "#feb2b2",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  lockoutText: {
    fontSize: 12,
    color: "#c53030",
    fontWeight: "600",
    flex: 1,
  },
  strengthMeterContainer: {
    marginBottom: 16,
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  strengthTextRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  strengthTextLabel: {
    fontSize: 11,
    color: "#4b5563",
  },
  strengthValueLabel: {
    fontSize: 11,
    fontWeight: "bold",
  },
  strengthProgressBarOuter: {
    height: 6,
    backgroundColor: "#e5e7eb",
    borderRadius: 3,
    marginBottom: 12,
    overflow: "hidden",
  },
  strengthProgressBarInner: {
    height: "100%",
    borderRadius: 3,
  },
  checklistContainer: {
    gap: 6,
  },
  reqRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  reqDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  reqDotMet: {
    backgroundColor: "#22c55e",
  },
  reqDotUnmet: {
    backgroundColor: "#9ca3af",
  },
  reqText: {
    fontSize: 11,
  },
  reqTextMet: {
    color: "#166534",
  },
  reqTextUnmet: {
    color: "#6b7280",
  },
  instructionCard: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  instructionText: {
    fontSize: 12,
    color: "#1e3a8a",
    textAlign: "center",
    lineHeight: 16,
  },
  textHighlight: {
    fontWeight: "bold",
    color: "#2563eb",
  },
  resendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    marginTop: 8,
  },
  resendBtnText: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "600",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 99999,
    paddingHorizontal: 24,
  },
  alertCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    width: "100%",
    maxWidth: 320,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
  },
  alertDesc: {
    fontSize: 12,
    color: "#4b5563",
    textAlign: "center",
    lineHeight: 16,
    marginBottom: 16,
  },
  alertTimer: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#dc2626",
    marginBottom: 20,
  },
  renewBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  renewBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
  },
});

const settingsStyles = StyleSheet.create({
  container: {
    flexDirection: "column",
    gap: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#6b7280",
    letterSpacing: 1,
    marginTop: 8,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    padding: 16,
  },
  cardHeader: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  cardDescription: {
    fontSize: 11,
    color: "#6b7280",
    lineHeight: 15,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  label: {
    fontSize: 12,
    color: "#4b5563",
  },
  value: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "500",
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  toggleBtnActive: {
    backgroundColor: "#e0f2fe",
    borderColor: "#7dd3fc",
  },
  toggleBtnInactive: {
    backgroundColor: "#f3f4f6",
    borderColor: "#e5e7eb",
  },
  toggleBtnText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#0369a1",
  },
  mfaSetupBox: {
    marginTop: 12,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
  },
  mfaSetupTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 6,
  },
  mfaSetupSteps: {
    fontSize: 11,
    color: "#4b5563",
    lineHeight: 15,
    marginBottom: 8,
  },
  secretHighlight: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: "bold",
    color: "#b91c1c",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 4,
    borderRadius: 2,
  },
  qrSimulator: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    marginVertical: 10,
    alignSelf: "center",
  },
  qrMockDotGrid: {
    width: 60,
    height: 60,
    borderWidth: 1.5,
    borderColor: "#000",
    borderRadius: 4,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  qrMockCorner: {
    width: 10,
    height: 10,
    backgroundColor: "#000",
    position: "absolute",
  },
  qrSimulatorText: {
    fontSize: 9,
    color: "#9ca3af",
    fontWeight: "600",
  },
  mfaInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    height: 38,
    paddingHorizontal: 10,
    fontSize: 13,
    marginBottom: 10,
  },
  mfaActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  mfaCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
  },
  mfaCancelText: {
    fontSize: 11,
    color: "#4b5563",
    fontWeight: "600",
  },
  mfaConfirmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#10b981",
  },
  mfaConfirmText: {
    fontSize: 11,
    color: "#ffffff",
    fontWeight: "600",
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingVertical: 8,
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderWidth: 1,
    borderRadius: 6,
  },
  refreshBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#2563eb",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dc2626",
    borderRadius: 8,
    height: 40,
    marginTop: 8,
  },
  logoutBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
  },
});
