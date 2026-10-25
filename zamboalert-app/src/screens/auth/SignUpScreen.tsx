import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { PrimaryButton } from '../../components/Button';
import PasswordStrength from '../../components/PasswordStrength';
import { useAuth, MIN_PASSWORD_SCORE, checkPasswordPolicy } from '../../context/AuthContext';
import {
  InputField,
  ErrorBox,
  AuthCardWrapper,
  RoleSelectStep,
  SelectedRoleBadge,
  AuthRole,
} from './components/AuthComponents';

type AuthNavigation = {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
};

type Step = 'role' | 'form';

export default function SignUpScreen({ navigation }: { navigation: AuthNavigation }) {
  const { signUp, loading, error, clearError } = useAuth();
  const [step, setStep] = useState<Step>('role');
  const [role, setRole] = useState<AuthRole>('citizen');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [localError, setLocalError] = useState('');

  const combinedError = localError || error;

  function handleChange() {
    if (localError) setLocalError('');
    if (error) clearError();
  }

  function handleRoleSelect(selected: AuthRole) {
    setRole(selected);
    handleChange();
    setStep('form');
  }

  function handleChangeRole() {
    handleChange();
    setStep('role');
  }

  async function handleSignUp() {
    const cleanFirstName = firstName.trim();
    const cleanMiddleName = middleName.trim();
    const cleanLastName = lastName.trim();
    const cleanContact = contactNumber.trim();
    const cleanEmail = email.trim();

    setLocalError('');
    if (!cleanFirstName) { setLocalError('Please enter your first name.'); return; }
    if (!cleanLastName) { setLocalError('Please enter your last name.'); return; }
    if (!cleanContact) { setLocalError('Please enter your contact number.'); return; }
    if (cleanContact.length < 7) { setLocalError('Please enter a valid contact number.'); return; }
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) { setLocalError('Please enter a valid email address.'); return; }
    if (checkPasswordPolicy(password).score < MIN_PASSWORD_SCORE) {
      setLocalError('Password must meet at least 4 of the 5 requirements below.');
      return;
    }
    if (password !== confirm) { setLocalError('Passwords do not match.'); return; }

    const started = await signUp(
      cleanFirstName,
      cleanLastName,
      cleanEmail,
      password,
      role,
      cleanContact,
      undefined,
      undefined,
      undefined,
      undefined,
      cleanMiddleName
    );
    if (started) {
      if (role === 'rescuer') {
        navigation.navigate('RescuerVerification', {
          registrationData: {
            firstName: cleanFirstName,
            middleName: cleanMiddleName,
            lastName: cleanLastName,
            email: cleanEmail,
            role,
            contactNumber: cleanContact,
          },
        });
      } else {
        navigation.navigate('Login');
      }
    }
  }

  // ── Step 1: Role selection (no form fields yet) ─────────────────────────────
  if (step === 'role') {
    return (
      <RoleSelectStep
        mode="register"
        onSelect={handleRoleSelect}
        switchLabel="Already have an account?"
        switchLinkLabel="Sign in"
        onSwitch={() => navigation.navigate('Login')}
      />
    );
  }

  // ── Step 2: Registration form (after role chosen) ───────────────────────────
  return (
    <AuthCardWrapper>
      <View style={styles.cardHeader}>
        <Text style={styles.heading}>Create account</Text>
        <Text style={styles.sub}>
          Fill in your details to join the emergency mesh network.
        </Text>
      </View>

      <SelectedRoleBadge role={role} mode="register" onChangeRole={handleChangeRole} />

      <InputField
        label="First Name"
        icon="person-outline"
        placeholder="Juan"
        value={firstName}
        onChangeText={(t) => {
          setFirstName(t);
          handleChange();
        }}
        autoCapitalize="words"
        autoCorrect={false}
        autoComplete="name-given"
      />

      <InputField
        label="Middle Name"
        icon="person-outline"
        placeholder="Protacio (Optional)"
        value={middleName}
        onChangeText={(t) => {
          setMiddleName(t);
          handleChange();
        }}
        autoCapitalize="words"
        autoCorrect={false}
        autoComplete="name-middle"
      />

      <InputField
        label="Last Name"
        icon="person-outline"
        placeholder="Dela Cruz"
        value={lastName}
        onChangeText={(t) => {
          setLastName(t);
          handleChange();
        }}
        autoCapitalize="words"
        autoCorrect={false}
        autoComplete="name-family"
      />

      <InputField
        label="Contact Number"
        icon="call-outline"
        placeholder="0912 345 6789"
        value={contactNumber}
        onChangeText={(t) => {
          setContactNumber(t);
          handleChange();
        }}
        keyboardType="phone-pad"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="tel"
        textContentType="telephoneNumber"
      />

      <InputField
        label="Email Address"
        icon="mail-outline"
        placeholder="you@example.com"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          handleChange();
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
      />

      <InputField
        label="Password"
        icon="lock-closed-outline"
        placeholder="Create strong password"
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          handleChange();
        }}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
        onRightIconPress={() => setShowPass(!showPassword)}
      />

      <PasswordStrength password={password} />

      <InputField
        label="Confirm Password"
        icon="lock-closed-outline"
        placeholder="Re-enter password"
        value={confirm}
        onChangeText={(t) => {
          setConfirm(t);
          handleChange();
        }}
        secureTextEntry={!showConfirm}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        rightIcon={showConfirm ? 'eye-off-outline' : 'eye-outline'}
        onRightIconPress={() => setShowConfirm(!showConfirm)}
      />

      {combinedError ? <ErrorBox message={combinedError} /> : null}

      {role === 'rescuer' && (
        <View style={styles.rescuerNoticeBox}>
          <Ionicons name="information-circle" size={18} color="#2563EB" />
          <Text style={styles.rescuerNoticeText}>
            Rescuer accounts require admin verification and document upload after signup.
          </Text>
        </View>
      )}

      <View style={styles.submitRow}>
        <PrimaryButton
          label={role === 'rescuer' ? 'Continue to Verification' : 'Create Account'}
          icon="checkmark-circle-outline"
          onPress={handleSignUp}
          disabled={
            !firstName.trim() ||
            !lastName.trim() ||
            !contactNumber.trim() ||
            !email.trim() ||
            !password ||
            !confirm
          }
          loading={loading}
        />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>Already have an account?</Text>
        <Pressable
          onPress={() => navigation.navigate('Login')}
          hitSlop={8}
          style={styles.switchLinkWrap}
        >
          <Text style={styles.switchLink}>Sign in</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.primary} />
        </Pressable>
      </View>
    </AuthCardWrapper>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    marginBottom: 16,
  },
  heading: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  sub: {
    marginTop: 6,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  rescuerNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  rescuerNoticeText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 17,
  },
  submitRow: {
    marginTop: 4,
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 6,
  },
  switchText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
  },
  switchLinkWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  switchLink: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: colors.primary,
  },
});
