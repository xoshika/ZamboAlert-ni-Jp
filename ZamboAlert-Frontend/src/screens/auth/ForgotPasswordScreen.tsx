import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { AlertCircle, Mail, Key, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react-native";
import { styles } from "../Auth.styles";
import { InputField, RequirementRow } from "../../components/FormElements";
import { PasswordRequirements } from "../../utils/password";

export interface ForgotPasswordScreenProps {
  forgotEmail: string;
  setForgotEmail: (text: string) => void;
  forgotCode: string;
  setForgotCode: (text: string) => void;
  forgotStep: 1 | 2;
  setForgotStep: (step: 1 | 2) => void;
  newPassword: string;
  setNewPassword: (text: string) => void;
  showNewPassword: boolean;
  setShowNewPassword: (show: boolean) => void;
  newPasswordStats: {
    score: number;
    color: string;
    label: string;
    requirements: PasswordRequirements;
  };
  handleForgotRequest: () => void;
  handleForgotReset: () => void;
  loading: boolean;
  onNavigateToLogin: () => void;
}

export function ForgotPasswordScreen({
  forgotEmail,
  setForgotEmail,
  forgotCode,
  setForgotCode,
  forgotStep,
  setForgotStep,
  newPassword,
  setNewPassword,
  showNewPassword,
  setShowNewPassword,
  newPasswordStats,
  handleForgotRequest,
  handleForgotReset,
  loading,
  onNavigateToLogin,
}: ForgotPasswordScreenProps) {
  return (
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
