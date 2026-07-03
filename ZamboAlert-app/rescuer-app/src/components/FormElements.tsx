import React from 'react';
import { View, TextInput, Text, TouchableOpacity } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { styles } from '../screens/Auth.styles';

// ── Shared Text Input Component ──────────────────────────────────────────────
export interface InputFieldProps {
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

export function InputField({
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
export function RequirementRow({ met, label }: { met: boolean; label: string }) {
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