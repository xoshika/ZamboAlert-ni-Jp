import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Mail, Key, RefreshCw, ArrowLeft } from "lucide-react-native";
import { styles } from "../Auth.styles";
import { InputField } from "../../components/FormElements";

export interface EmailVerifyScreenProps {
  verifyEmail: string;
  verifyCode: string;
  setVerifyCode: (text: string) => void;
  handleVerifyEmail: () => void;
  handleResendCode: () => void;
  loading: boolean;
  onNavigateToLogin: () => void;
}

export function EmailVerifyScreen({
  verifyEmail,
  verifyCode,
  setVerifyCode,
  handleVerifyEmail,
  handleResendCode,
  loading,
  onNavigateToLogin,
}: EmailVerifyScreenProps) {
  return (
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
        onPress={handleResendCode}
        style={styles.resendBtn}
      >
        <RefreshCw size={12} color="#2563eb" style={{ marginRight: 6 }} />
        <Text style={styles.resendBtnText}>Resend verification code</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onNavigateToLogin}
        style={styles.backLink}
      >
        <ArrowLeft size={14} color="#4b5563" style={{ marginRight: 6 }} />
        <Text style={styles.backLinkText}>Return to Login Gate</Text>
      </TouchableOpacity>
    </View>
  );
}
