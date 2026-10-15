import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Lock,
  Mail,
  User,
  ShieldAlert,
  Clock,
  Fingerprint,
  Smartphone,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
} from "lucide-react";

import LoginBrandPanel from "./LoginBrandPanel";
import LoginFormCard from "./LoginFormCard";
import ViewHeader from "./ViewHeader";
import PasswordStrengthMeter from "./PasswordStrengthMeter";

export default function LoginPage() {
  const navigate = useNavigate();

  const [view, setView] = useState("login");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [emailOpened, setEmailOpened] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const isLoggingInRef = useRef(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const resendRef = useRef(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [mfaCode, setMfaCode] = useState("123456");
  const [strength, setStrength] = useState({
    score: 0,
    label: "None",
    color: "bg-slate-200",
    checks: { length: false, upper: false, lower: false, number: false, special: false },
  });
  const [notification, setNotification] = useState({ msg: "", type: "" });
  const timerRef = useRef(null);
  const notificationTimeoutRef = useRef(null);

  const API_BASE_URL = (
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_TELEMETRY_URL ||
    ""
  ).replace(/\/$/, "");

  const API_PORTS = [Number(import.meta.env.VITE_API_PORT || 5000), 5001, 5002, 5003, 5010];

  const apiRequest = async (endpoint, options = {}) => {
    if (API_BASE_URL) {
      return fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });
    }

    let lastError;

    for (const port of API_PORTS) {
      try {
        const response = await fetch(`http://localhost:${port}${endpoint}`, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
          },
        });

        if (response.status !== 404) {
          return response;
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      throw lastError;
    }

    return fetch(`http://localhost:${API_PORTS[0]}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
  };

  const inputClassName =
    "w-full bg-[#f8f9fa] border border-slate-200 focus:border-red-600 focus:bg-white rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:ring-2 focus:ring-red-600/10";
  const primaryButtonClassName =
    "w-full py-2.5 px-4 bg-red-700 hover:bg-red-800 active:bg-red-900 text-white font-semibold text-sm rounded-lg transition-all shadow-sm hover:shadow-md hover:shadow-red-700/15 cursor-pointer";

  useEffect(() => {
    const generateMfa = () => setMfaCode(Math.floor(100000 + Math.random() * 900000).toString());
    generateMfa();
    const interval = setInterval(generateMfa, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checks = {
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };

    const count = Object.values(checks).filter(Boolean).length;
    let label = "None";
    let color = "bg-slate-200";

    if (password.length > 0) {
      if (count <= 2) {
        label = "Weak (Insecure)";
        color = "bg-red-700";
      } else if (count <= 4) {
        label = "Medium (Fair)";
        color = "bg-amber-500";
      } else {
        label = "Strong (Secure)";
        color = "bg-green-500";
      }
    }

    setStrength({ score: count, label, color, checks });
  }, [password]);

  useEffect(() => {
    if (lockoutTime > 0) {
      timerRef.current = setInterval(() => {
        setLockoutTime((time) => {
          if (time <= 1) {
            clearInterval(timerRef.current);
            setView("login");
            setFailedAttempts(0);
            return 0;
          }
          return time - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lockoutTime]);

  const showNotificationMsg = (msg, type = "error") => {
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    setNotification({ msg, type });
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification({ msg: "", type: "" });
    }, 4000);
  };

  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (view !== "mfa") return;
    if (resendTimer <= 0) return;

    resendRef.current = setInterval(() => {
      setResendTimer((time) => {
        if (time <= 1) {
          clearInterval(resendRef.current);
          return 0;
        }
        return time - 1;
      });
    }, 1000);

    return () => clearInterval(resendRef.current);
  }, [view, resendTimer === 60]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isLoggingInRef.current) return;
    if (failedAttempts >= 2) {
      setView("locked");
      setLockoutTime(30);
      return;
    }

    isLoggingInRef.current = true;
    setIsLoggingIn(true);

    try {
      const response = await apiRequest("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();

      if (response.ok) {
        setView("mfa");
        setResendTimer(60);
        setEmailOpened(false);
        showNotificationMsg(data.message || "2FA Code sent to your official email.", "success");
        if (data.code) {
          setTwoFactorCode(data.code);
        }
      } else if (response.status === 403 && data.unverified) {
        setEmail(data.email);
        setView("verify");
        showNotificationMsg(data.message, "warning");
      } else {
        const nextAttempt = failedAttempts + 1;
        setFailedAttempts(nextAttempt);
        showNotificationMsg(`${data.message || "Invalid username or password!"} Attempt ${nextAttempt}/3.`, "error");
      }
    } catch (error) {
      showNotificationMsg("Cannot connect to backend server. Make sure it is running.", "error");
    } finally {
      isLoggingInRef.current = false;
      setIsLoggingIn(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      showNotificationMsg("Passwords do not match!", "error");
      return;
    }
    if (strength.score < 3) {
      showNotificationMsg("Password is too weak. Please ensure it is at least medium strength.", "error");
      return;
    }

    try {
      const response = await apiRequest("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName, lastName, phoneNumber, password }),
      });
      const data = await response.json();

      if (response.ok) {
        setView("verify");
        showNotificationMsg(data.message || "Verification code sent to your email. Check your inbox.", "success");
        if (data.code) {
          setVerificationCode(data.code);
        }
        setPassword("");
        setConfirmPassword("");
      } else {
        showNotificationMsg(data.message || data.error || "Registration failed", "error");
      }
    } catch (error) {
      showNotificationMsg("Cannot connect to backend server. Make sure it is running.", "error");
    }
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    try {
      const response = await apiRequest("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: verificationCode }),
      });
      const data = await response.json();

      if (response.ok) {
        showNotificationMsg("Email verified successfully! You can now log in.", "success");
        setView("login");
        setEmail("");
        setUsername("");
        setPassword("");
        setConfirmPassword("");
        setVerificationCode("");
        setPhoneNumber("");
      } else {
        showNotificationMsg(data.message || "Invalid verification code!", "error");
      }
    } catch (error) {
      showNotificationMsg("Cannot connect to backend server.", "error");
    }
  };

  const handleMfa = async (e) => {
    e.preventDefault();
    try {
      const response = await apiRequest("/api/auth/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, code: otp }),
      });
      const data = await response.json();

      if (response.ok) {
        localStorage.setItem(
          "zamboalert_auth",
          JSON.stringify({
            token: data.token,
            user: data.user,
            expiry: data.expiry,
          })
        );
        navigate("/dashboard");
      } else {
        showNotificationMsg(data.message || "Invalid MFA Code!", "error");
      }
    } catch (error) {
      showNotificationMsg("Cannot connect to backend server.", "error");
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    try {
      const response = await apiRequest("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (response.ok) {
        showNotificationMsg(data.message || "Password reset code sent to your email.", "success");
        if (data.code) {
          setResetCode(data.code);
        }
        setView("reset_password");
        setVerificationCode("");
        setPassword("");
        setConfirmPassword("");
      } else {
        showNotificationMsg(data.message || "Failed to request password reset", "error");
      }
    } catch (error) {
      showNotificationMsg("Cannot connect to backend server. Make sure it is running.", "error");
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      showNotificationMsg("Passwords do not match!", "error");
      return;
    }
    if (strength.score < 3) {
      showNotificationMsg("Password is too weak. Please ensure it is at least medium strength.", "error");
      return;
    }

    try {
      const response = await apiRequest("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: verificationCode, newPassword: password }),
      });
      const data = await response.json();

      if (response.ok) {
        showNotificationMsg("Password reset successfully! You can now log in.", "success");
        setView("login");
        setEmail("");
        setUsername("");
        setPassword("");
        setConfirmPassword("");
        setVerificationCode("");
      } else {
        showNotificationMsg(data.message || "Failed to reset password", "error");
      }
    } catch (error) {
      showNotificationMsg("Cannot connect to backend server. Make sure it is running.", "error");
    }
  };

  const MobileBrandHeader = () => (
    <div className="flex flex-col items-center justify-center mb-8 lg:hidden">
      <img src="/zamboalert.png" alt="ZamboAlert Logo" className="w-12 h-12 object-contain mb-2" />
      <span className="font-extrabold text-xl text-slate-900 tracking-tight">ZamboAlert</span>
      <p className="text-[9px] font-bold text-red-700/70 uppercase tracking-[0.2em] mt-1.5">
        Disaster Response Portal
      </p>
    </div>
  );

  const NotificationBanner = () =>
    notification.msg ? (
      <div
        className={`mb-5 p-3 rounded-xl border text-xs flex items-center justify-between transition-all duration-300 ${
          notification.type === "success"
            ? "bg-green-50 border-green-200 text-green-800"
            : notification.type === "info"
              ? "bg-blue-50 border-blue-200 text-blue-800"
              : "bg-rose-50 border-rose-200 text-red-800"
        }`}
      >
        <div className="flex items-center gap-2">
          {notification.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
          ) : (
            <ShieldAlert className="h-4 w-4 text-red-700 flex-shrink-0" />
          )}
          <span>{notification.msg}</span>
        </div>
        <button
          type="button"
          onClick={() => setNotification({ msg: "", type: "" })}
          className="text-slate-400 hover:text-slate-600 bg-transparent border-0 cursor-pointer p-1 text-sm font-semibold leading-none ml-2"
        >
          ×
        </button>
      </div>
    ) : null;

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-900 flex font-sans relative overflow-hidden">
      <LoginBrandPanel />

      <div className="flex-1 flex flex-col items-center justify-center min-h-screen px-5 py-8 sm:px-8 relative">
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.015]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #991b1b 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />

        <div className="w-full max-w-[420px] relative z-10">
          <MobileBrandHeader />

          <LoginFormCard>
            <ViewHeader
              title={
                view === "login"
                  ? "Sign in"
                  : view === "register"
                    ? "Create account"
                    : view === "verify"
                      ? "Verify email"
                      : view === "mfa"
                        ? "Two-factor auth"
                        : view === "locked"
                          ? "Account locked"
                          : view === "forgot_password"
                            ? "Forgot password"
                            : "Reset password"
              }
              subtitle={
                view === "login"
                  ? "Access the ZamboAlert disaster portal"
                  : view === "register"
                    ? "Register as an authorized official"
                    : view === "verify"
                      ? "Confirm your official email address"
                      : view === "mfa"
                        ? "Enter your verification code"
                        : view === "locked"
                          ? "Too many failed attempts"
                          : view === "forgot_password"
                            ? "We'll send you a reset code"
                            : "Choose a new password"
              }
            />

            <NotificationBanner />

            {view === "login" && (
              <div>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="official@barangay.gov.ph"
                        className={`${inputClassName} pl-10`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type={showLoginPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`${inputClassName} pl-10 pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer bg-transparent border-0 p-0"
                        aria-label={showLoginPassword ? "Hide password" : "Show password"}
                      >
                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="flex justify-end mt-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setView("forgot_password");
                          setEmail("");
                        }}
                        className="text-xs text-red-600 hover:text-red-700 hover:underline bg-transparent border-0 cursor-pointer p-0 font-medium"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    aria-busy={isLoggingIn}
                    className={`${primaryButtonClassName} inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70`}
                  >
                    {isLoggingIn && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    <span>{isLoggingIn ? "Signing in..." : "Sign In"}</span>
                  </button>
                </form>

                <div className="mt-6 pt-4 border-t border-slate-100 text-center text-sm text-slate-500">
                  New official?{" "}
                  <button
                    onClick={() => {
                      setView("register");
                      setPassword("");
                      setConfirmPassword("");
                    }}
                    className="text-red-600 font-semibold hover:underline bg-transparent border-0 cursor-pointer p-0"
                  >
                    Create an account
                  </button>
                </div>
              </div>
            )}

            {view === "register" && (
              <div>
                <form onSubmit={handleRegister} className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">First Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          required
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Juan"
                          className={`${inputClassName} pl-10`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Last Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          required
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Dela Cruz"
                          className={`${inputClassName} pl-10`}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Phone Number</label>
                    <div className="relative">
                      <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="Enter your number"
                        className={`${inputClassName} pl-10`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Official Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="official@barangay.gov.ph"
                        className={`${inputClassName} pl-10`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`${inputClassName} pl-10 pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer bg-transparent border-0 p-0"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <PasswordStrengthMeter strength={strength} password={password} />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`${inputClassName} pl-10 pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer bg-transparent border-0 p-0"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" className={primaryButtonClassName}>
                    Create Account
                  </button>
                </form>

                <div className="mt-5 pt-4 border-t border-slate-100 text-center text-sm text-slate-500">
                  Already registered?{" "}
                  <button
                    onClick={() => {
                      setView("login");
                      setPassword("");
                      setConfirmPassword("");
                    }}
                    className="text-red-600 font-semibold hover:underline bg-transparent border-0 cursor-pointer p-0"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            )}

            {view === "verify" && (
              <div>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                    <Mail className="text-red-700 h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Email Verification</h3>
                    <p className="text-xs text-slate-500">Enter the code sent to {email}</p>
                  </div>
                </div>

                <form onSubmit={handleVerifyEmail} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5 text-center">6-Digit Verification Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      className="w-full bg-[#f8f9fa] border border-slate-200 focus:border-red-600 focus:bg-white rounded-lg px-3 py-3 text-center font-mono tracking-widest text-xl text-slate-900 placeholder:text-slate-300 outline-none transition-all focus:ring-2 focus:ring-red-600/10"
                    />
                  </div>

                  <button type="submit" className={primaryButtonClassName}>
                    Verify Code
                  </button>
                </form>

                <div className="mt-5 pt-4 border-t border-slate-100 text-center text-sm text-slate-500">
                  Incorrect email?{" "}
                  <button onClick={() => setView("register")} className="text-red-600 font-semibold hover:underline bg-transparent border-0 cursor-pointer p-0">
                    Back to Register
                  </button>
                </div>
              </div>
            )}

            {view === "mfa" && (
              <div>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                    <Fingerprint className="text-red-700 h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Two-Factor Verification</h3>
                    <p className="text-xs text-slate-500">MFA is mandatory for Barangay command nodes</p>
                  </div>
                </div>

                <div className="mb-5 space-y-2">
                  <div className="flex items-start gap-2 text-[11px] text-slate-600 bg-blue-50/60 border border-blue-100 rounded-xl px-3 py-2.5">
                    <Mail className="h-3.5 w-3.5 text-red-700 flex-shrink-0 mt-0.5" />
                    <span>
                      A 6-digit verification code has been sent to your Gmail at{" "}
                      <span className="font-mono font-semibold text-slate-800">
                        {username ? `${username.slice(0, 2)}${"..".repeat(2)}@gmail.com` : "br**@gmail.com"}
                      </span>. Check your Gmail inbox to get the code.
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-1">
                    {resendTimer > 0 ? (
                      <p className="text-[11px] text-slate-400">
                        Resend code in{" "}
                        <span className="font-mono font-semibold text-slate-600">
                          {String(Math.floor(resendTimer / 60)).padStart(2, "0")}:
                          {String(resendTimer % 60).padStart(2, "0")}
                        </span>
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const response = await apiRequest("/api/auth/resend-code", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                email: email || (username.includes("@") ? username : `${username}@gmail.com`),
                                type: "mfa",
                              }),
                            });
                            const data = await response.json();
                            if (response.ok) {
                              showNotificationMsg(data.message || "A new MFA code has been sent to your email.", "success");
                              if (data.code) {
                                setTwoFactorCode(data.code);
                              }
                              setResendTimer(60);
                              setEmailOpened(false);
                            } else {
                              showNotificationMsg(data.message, "error");
                            }
                          } catch (error) {
                            showNotificationMsg("Failed to resend MFA code.", "error");
                          }
                        }}
                        className="text-[11px] text-red-600 font-semibold hover:underline bg-transparent border-0 cursor-pointer p-0"
                      >
                        ↺ Send the code again
                      </button>
                    )}
                  </div>
                </div>

                <form onSubmit={handleMfa} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5 text-center">Enter 6-Digit Code from Email</label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      placeholder="––  ––  ––"
                      className="w-full bg-[#f8f9fa] border border-slate-200 focus:border-red-600 focus:bg-white rounded-lg px-3 py-3 text-center font-mono tracking-[0.4em] text-2xl text-slate-900 placeholder:text-slate-300 outline-none transition-all focus:ring-2 focus:ring-red-600/10"
                    />
                  </div>

                  <button type="submit" className={primaryButtonClassName}>
                    Authorize Session
                  </button>
                </form>
              </div>
            )}

            {view === "locked" && (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert className="text-red-700 h-8 w-8 animate-bounce" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 mb-2">Account Temporarily Locked</h2>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mb-5">
                  Too many failed authentication attempts. Access is restricted for security policies.
                </p>

                <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 inline-flex items-center gap-3 mb-6">
                  <Clock className="text-red-700 h-5 w-5 animate-pulse" />
                  <div className="text-left">
                    <span className="text-[9px] font-mono text-red-700 uppercase tracking-widest block">Lockout Timer</span>
                    <span className="text-lg font-mono text-red-700 font-bold">{lockoutTime} seconds remaining</span>
                  </div>
                </div>
              </div>
            )}

            {view === "forgot_password" && (
              <div>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                    <Lock className="text-red-700 h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Forgot Password</h3>
                    <p className="text-xs text-slate-500">We'll send you a verification code</p>
                  </div>
                </div>

                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Official Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="official@barangay.gov.ph"
                        className={`${inputClassName} pl-10`}
                      />
                    </div>
                  </div>

                  <button type="submit" className={primaryButtonClassName}>
                    Send Reset Code
                  </button>
                </form>

                <div className="mt-5 pt-4 border-t border-slate-100 text-center text-sm text-slate-500">
                  Remember your password?{" "}
                  <button type="button" onClick={() => setView("login")} className="text-red-600 font-semibold hover:underline bg-transparent border-0 cursor-pointer p-0">
                    Back to Sign In
                  </button>
                </div>
              </div>
            )}

            {view === "reset_password" && (
              <div>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                    <Lock className="text-red-700 h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Reset Password</h3>
                    <p className="text-xs text-slate-500">Enter the code sent to {email}</p>
                  </div>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5 text-center">6-Digit Verification Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      className="w-full bg-[#f8f9fa] border border-slate-200 focus:border-red-600 focus:bg-white rounded-lg px-3 py-3 text-center font-mono tracking-widest text-xl text-slate-900 placeholder:text-slate-300 outline-none transition-all focus:ring-2 focus:ring-red-600/10"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`${inputClassName} pl-10 pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer bg-transparent border-0 p-0"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <PasswordStrengthMeter strength={strength} password={password} />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Confirm New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`${inputClassName} pl-10 pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer bg-transparent border-0 p-0"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" className={primaryButtonClassName}>
                    Reset Password
                  </button>
                </form>

                <div className="mt-5 pt-4 border-t border-slate-100 text-center text-sm text-slate-500">
                  Cancel resetting?{" "}
                  <button type="button" onClick={() => setView("login")} className="text-red-600 font-semibold hover:underline bg-transparent border-0 cursor-pointer p-0">
                    Back to Sign In
                  </button>
                </div>
              </div>
            )}
          </LoginFormCard>

          <div className="mt-6 text-center">
            <p className="text-[11px] text-slate-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
