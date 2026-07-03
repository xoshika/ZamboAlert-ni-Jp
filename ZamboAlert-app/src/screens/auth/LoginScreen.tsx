import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { User, Lock, Clock, Eye, EyeOff } from "lucide-react-native";
import { styles } from "../Auth.styles";
import { InputField } from "../../components/FormElements";

export interface LoginScreenProps {
  usernameInput: string;
  setUsernameInput: (text: string) => void;
  passwordInput: string;
  setPasswordInput: (text: string) => void;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  lockoutTimeLeft: number;
  handleCheckLockout: (text: string) => void;
  handleLogin: () => void;
  loading: boolean;
  onNavigateToRegister: () => void;
  onNavigateToForgotPassword: () => void;
}

export function LoginScreen({
  usernameInput,
  setUsernameInput,
  passwordInput,
  setPasswordInput,
  showPassword,
  setShowPassword,
  lockoutTimeLeft,
  handleCheckLockout,
  handleLogin,
  loading,
  onNavigateToRegister,
  onNavigateToForgotPassword,
}: LoginScreenProps) {
  return (
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
        onPress={onNavigateToForgotPassword}
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
        onPress={onNavigateToRegister}
        style={styles.secondaryBtn}
        disabled={loading}
      >
        <Text style={styles.secondaryBtnText}>Register New Rescuer Profile</Text>
      </TouchableOpacity>
    </View>
  );
}
