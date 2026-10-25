import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';

export type InputFieldProps = {
  label?: string;
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  autoComplete?: any;
  textContentType?: any;
  maxLength?: number;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
};

export type RolePillProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  subtitle: string;
  active: boolean;
  onPress: () => void;
};

export type AuthRole = 'citizen' | 'rescuer';

export type RoleSelectStepProps = {
  mode: 'signin' | 'register';
  onSelect: (role: AuthRole) => void;
  switchLabel: string;
  switchLinkLabel: string;
  onSwitch: () => void;
};

export function InputField({
  label,
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  autoCorrect = false,
  autoComplete,
  textContentType,
  maxLength,
  rightIcon,
  onRightIconPress,
}: InputFieldProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  return (
    <View style={styles.inputGroup}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <Pressable
        onPress={() => inputRef.current?.focus()}
        style={[styles.inputWrap, focused && styles.inputWrapFocused]}
      >
        <Ionicons
          name={icon}
          size={19}
          color={focused ? colors.primary : colors.textMuted}
          style={styles.inputLeadingIcon}
        />
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          autoComplete={autoComplete}
          textContentType={textContentType}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {rightIcon ? (
          <Pressable onPress={onRightIconPress} hitSlop={10} style={styles.rightIconPressable}>
            <Ionicons name={rightIcon} size={19} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </Pressable>
    </View>
  );
}

export function ErrorBox({
  message,
  onOpenApprovalModal,
}: {
  message: string;
  onOpenApprovalModal?: () => void;
}) {
  const isPending =
    message.toLowerCase().includes('pending admin verification') ||
    message.toLowerCase().includes('pending approval');

  if (isPending) {
    return (
      <View style={styles.pendingBox}>
        <View style={styles.pendingIconWrap}>
          <Ionicons name="hourglass" size={18} color="#D97706" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.pendingTitle}>Verification Pending</Text>
          <Text style={styles.pendingText}>{message}</Text>
          {onOpenApprovalModal ? (
            <Pressable onPress={onOpenApprovalModal} style={styles.pendingActionBtn}>
              <Text style={styles.pendingActionText}>View Approval Status</Text>
              <Ionicons name="chevron-forward" size={13} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle" size={18} color={colors.primary} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function DevCodeHint({ code }: { code: string }) {
  return (
    <View style={styles.devBox}>
      <Ionicons name="bulb-outline" size={16} color="#D97706" />
      <Text style={styles.devText}>
        Test Environment Demo Code: <Text style={styles.devCode}>{code}</Text>
      </Text>
    </View>
  );
}

export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.backLink} hitSlop={8}>
      <Ionicons name="arrow-back-outline" size={15} color={colors.textSecondary} />
      <Text style={styles.backLinkText}>{label}</Text>
    </Pressable>
  );
}

export function RolePill({ label, subtitle, icon, active, onPress }: RolePillProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.rolePill,
        active && styles.rolePillActive,
        pressed && styles.rolePillPressed,
      ]}
    >
      <View style={[styles.roleIconWrap, active && styles.roleIconWrapActive]}>
        <Ionicons name={icon} size={20} color={active ? colors.primary : colors.textSecondary} />
      </View>
      <View style={styles.roleTextWrap}>
        <Text style={[styles.rolePillTitle, active && styles.rolePillTitleActive]}>{label}</Text>
        <Text style={[styles.rolePillSub, active && styles.rolePillSubActive]}>{subtitle}</Text>
      </View>
      {active && (
        <View style={styles.activeCheckmark}>
          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
        </View>
      )}
    </Pressable>
  );
}

/** First-step screen: pick Citizen or Rescuer before showing form fields. */
export function RoleSelectStep({
  mode,
  onSelect,
  switchLabel,
  switchLinkLabel,
  onSwitch,
}: RoleSelectStepProps) {
  const isSignIn = mode === 'signin';
  const verb = isSignIn ? 'signing in' : 'registering';

  return (
    <AuthCardWrapper>
      <View style={styles.roleSelectHeader}>
        <Text style={styles.roleSelectHeading}>
          {isSignIn ? 'Welcome back' : 'Create account'}
        </Text>
        <Text style={styles.roleSelectSub}>
          {isSignIn
            ? 'Choose how you want to sign in to continue.'
            : 'Choose your role to start creating your account.'}
        </Text>
      </View>

      <View style={styles.roleSelectStack}>
        <RoleSelectOption
          title={`I am ${verb} as Citizen`}
          subtitle="SOS alerts & emergency tools"
          icon="person-circle-outline"
          onPress={() => onSelect('citizen')}
        />
        <RoleSelectOption
          title={`I am ${verb} as Rescuer`}
          subtitle="Field responder access"
          icon="shield-checkmark-outline"
          onPress={() => onSelect('rescuer')}
        />
      </View>

      <View style={styles.roleSelectSwitchRow}>
        <Text style={styles.roleSelectSwitchText}>{switchLabel}</Text>
        <Pressable onPress={onSwitch} hitSlop={8} style={styles.roleSelectSwitchLinkWrap}>
          <Text style={styles.roleSelectSwitchLink}>{switchLinkLabel}</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.primary} />
        </Pressable>
      </View>
    </AuthCardWrapper>
  );
}

function RoleSelectOption({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.roleSelectCard,
        pressed && styles.roleSelectCardPressed,
      ]}
    >
      <View style={styles.roleSelectIconWrap}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <View style={styles.roleSelectTextWrap}>
        <Text style={styles.roleSelectTitle}>{title}</Text>
        <Text style={styles.roleSelectSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

/** Compact selected-role chip shown above form fields, with change action. */
export function SelectedRoleBadge({
  role,
  mode,
  onChangeRole,
}: {
  role: AuthRole;
  mode: 'signin' | 'register';
  onChangeRole: () => void;
}) {
  const verb = mode === 'signin' ? 'Signing in' : 'Registering';
  const isCitizen = role === 'citizen';

  return (
    <View style={styles.selectedRoleRow}>
      <View style={styles.selectedRoleBadge}>
        <Ionicons
          name={isCitizen ? 'person-circle-outline' : 'shield-checkmark-outline'}
          size={16}
          color={colors.primary}
        />
        <Text style={styles.selectedRoleText}>
          {verb} as {isCitizen ? 'Citizen' : 'Rescuer'}
        </Text>
      </View>
      <Pressable onPress={onChangeRole} hitSlop={8} style={styles.changeRoleBtn}>
        <Text style={styles.changeRoleText}>Change</Text>
      </Pressable>
    </View>
  );
}

export function AuthCardWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <View pointerEvents="none" style={styles.bgDecorCircleTop} />
      <View pointerEvents="none" style={styles.bgDecorCircleBottom} />
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          <View style={styles.authCard}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8F9FB',
  },
  keyboardAvoid: {
    flex: 1,
    width: '100%',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  bgDecorCircleTop: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(224, 52, 43, 0.08)',
  },
  bgDecorCircleBottom: {
    position: 'absolute',
    bottom: -100,
    left: -70,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(47, 111, 237, 0.04)',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 70,
    alignItems: 'center',
    width: '100%',
  },
  authCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: '#EAECEF',
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
    marginBottom: 20,
  },
  fieldLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#374151',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    height: 52,
  },
  inputWrapFocused: {
    borderColor: colors.primary,
    backgroundColor: '#FFFFFF',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  inputLeadingIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    color: colors.textPrimary,
    height: '100%',
    paddingVertical: 0,
  },
  rightIconPressable: {
    padding: 4,
    marginLeft: 6,
  },
  rolePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFB',
    position: 'relative',
    gap: 8,
  },
  rolePillActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(224, 52, 43, 0.04)',
  },
  rolePillPressed: {
    opacity: 0.85,
  },
  roleIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconWrapActive: {
    backgroundColor: 'rgba(224, 52, 43, 0.12)',
  },
  roleTextWrap: {
    flex: 1,
  },
  rolePillTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13.5,
    color: colors.textPrimary,
  },
  rolePillTitleActive: {
    color: colors.primary,
  },
  rolePillSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10.5,
    color: colors.textMuted,
    marginTop: 1,
  },
  rolePillSubActive: {
    color: colors.primary,
    opacity: 0.85,
  },
  activeCheckmark: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(224, 52, 43, 0.08)',
    borderColor: 'rgba(224, 52, 43, 0.25)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    color: colors.primary,
    lineHeight: 18,
  },
  pendingBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  pendingIconWrap: {
    marginTop: 2,
  },
  pendingTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: '#92400E',
  },
  pendingText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    color: '#B45309',
    marginTop: 2,
    lineHeight: 17,
  },
  pendingActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D97706',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 10,
    alignSelf: 'flex-start',
    gap: 4,
  },
  pendingActionText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  devBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  devText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#92400E',
  },
  devCode: {
    fontFamily: 'Inter_700Bold',
    color: '#B45309',
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
  },
  backLinkText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
  },
  roleSelectHeader: {
    marginBottom: 24,
  },
  roleSelectHeading: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  roleSelectSub: {
    marginTop: 6,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  roleSelectStack: {
    gap: 12,
    marginBottom: 24,
  },
  roleSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFB',
  },
  roleSelectCardPressed: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(224, 52, 43, 0.04)',
    opacity: 0.92,
  },
  roleSelectIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(224, 52, 43, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleSelectTextWrap: {
    flex: 1,
  },
  roleSelectTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  roleSelectSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 3,
  },
  roleSelectSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 6,
  },
  roleSelectSwitchText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
  },
  roleSelectSwitchLinkWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  roleSelectSwitchLink: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: colors.primary,
  },
  selectedRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  selectedRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(224, 52, 43, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(224, 52, 43, 0.2)',
  },
  selectedRoleText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    color: colors.primary,
  },
  changeRoleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  changeRoleText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
  },
});
