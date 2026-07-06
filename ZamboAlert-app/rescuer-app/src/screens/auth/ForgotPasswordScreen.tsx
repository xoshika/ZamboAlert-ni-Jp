import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Mail, ArrowLeft } from "lucide-react-native";
import { styles } from "../Auth.styles";
import { InputField } from "../../components/FormElements";

export interface ForgotPasswordScreenProps {
  forgotEmail: string;
  setForgotEmail: (text: string) => void;
  handleForgotRequest: () => void;
  loading: boolean;
  onNavigateToLogin: () => void;
}

export function ForgotPasswordScreen({
  forgotEmail,
  setForgotEmail,
  handleForgotRequest,
  loading,
  onNavigateToLogin,
}: ForgotPasswordScreenProps) {
  return (
    <View style={styles.formContainer}>
      <View style={styles.instructionCard}>
        <Text style={styles.instructionText}>
          Enter your registered email address. We will dispatch a secure link to reset your credentials.
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
        disabled={loading || !forgotEmail.includes("@")}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text style={styles.primaryBtnText}>Request Reset Link</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onNavigateToLogin}
        style={styles.backLink}
        disabled={loading}
      >
        <ArrowLeft size={14} color="#4b5563" style={{ marginRight: 6 }} />
        <Text style={styles.backLinkText}>Return to Login Gate</Text>
      </TouchableOpacity>
    </View>
  );
}
