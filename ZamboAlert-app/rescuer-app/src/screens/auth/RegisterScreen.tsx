import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { User, Mail, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react-native";
import { styles } from "../Auth.styles";
import { InputField, RequirementRow } from "../../components/FormElements";
import { PasswordRequirements } from "../../utils/password";

export interface RegisterScreenProps {
  firstNameInput: string;
  setFirstNameInput: (text: string) => void;
  lastNameInput: string;
  setLastNameInput: (text: string) => void;
  emailInput: string;
  setEmailInput: (text: string) => void;
  passwordInput: string;
  setPasswordInput: (text: string) => void;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  passwordStats: {
    score: number;
    color: string;
    label: string;
    requirements: PasswordRequirements;
  };
  handleRegister: () => void;
  loading: boolean;
  onNavigateToLogin: () => void;
}

export function RegisterScreen({
  firstNameInput,
  setFirstNameInput,
  lastNameInput,
  setLastNameInput,
  emailInput,
  setEmailInput,
  passwordInput,
  setPasswordInput,
  showPassword,
  setShowPassword,
  passwordStats,
  handleRegister,
  loading,
  onNavigateToLogin,
}: RegisterScreenProps) {
  return (
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
