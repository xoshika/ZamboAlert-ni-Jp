import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Platform } from 'react-native';
import { ShieldCheck, User, LogOut, Clock, RefreshCw, Key, ShieldAlert, Smartphone } from 'lucide-react-native';
import { styles, settingsStyles } from '../screens/Auth.styles';
import { UserRecord, SessionDetails } from '../utils/authData';
import { InputField } from './FormElements';

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