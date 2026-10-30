import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
  Alert,
  TextInput,
  Animated,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../theme/colors';
import { typography, fontFamily } from '../../theme/typography';
import WaitingForApprovalModal from '../../components/Approval';
import { API_BASE_URL } from '../../config';

// ─── Types ───────────────────────────────────────────────────────────────────

type IdSide = 'front' | 'back';

type IdType = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
};

type IdPhotoSlotProps = {
  side: IdSide;
  uri: string;
  onPress: (side: IdSide) => void;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const ID_TYPES: IdType[] = [
  { key: 'Barangay ID',   label: 'Barangay ID',   icon: 'business-outline',   description: 'Issued by your local barangay office' },
  { key: 'Government ID', label: 'Government ID',  icon: 'card-outline',       description: 'National ID, SSS, GSIS, PhilHealth, etc.' },
  { key: 'Drivers License', label: "Driver's License", icon: 'car-outline',   description: "LTO-issued driver's license" },
  { key: 'Passport',      label: 'Passport',       icon: 'globe-outline',      description: 'Philippine passport' },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.stepRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.stepDot,
            i < current ? styles.stepDotComplete : i === current ? styles.stepDotActive : styles.stepDotInactive,
          ]}
        />
      ))}
    </View>
  );
}

function IdTypeCard({ idType, selected, onPress }: { idType: IdType; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.idTypeCard,
        selected && styles.idTypeCardActive,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.idTypeIconWrap, selected && styles.idTypeIconWrapActive]}>
        <Ionicons
          name={idType.icon}
          size={20}
          color={selected ? colors.primary : colors.textSecondary}
        />
      </View>
      <View style={styles.idTypeTextWrap}>
        <Text style={[styles.idTypeLabel, selected && styles.idTypeLabelActive]}>
          {idType.label}
        </Text>
        <Text style={styles.idTypeDesc} numberOfLines={1}>
          {idType.description}
        </Text>
      </View>
      <View style={[styles.idTypeRadio, selected && styles.idTypeRadioActive]}>
        {selected && <View style={styles.idTypeRadioDot} />}
      </View>
    </Pressable>
  );
}

function IdPhotoSlot({ side, uri, onPress }: IdPhotoSlotProps) {
  const isUploaded = !!uri;
  const label = side === 'front' ? 'Front Side' : 'Back Side';
  const icon: keyof typeof Ionicons.glyphMap = side === 'front' ? 'id-card-outline' : 'card-outline';

  return (
    <Pressable
      onPress={() => onPress(side)}
      style={({ pressed }) => [
        styles.photoSlot,
        isUploaded && styles.photoSlotUploaded,
        pressed && { opacity: 0.8 },
      ]}
    >
      {isUploaded ? (
        <>
          <Image source={{ uri }} style={styles.photoPreview} resizeMode="cover" />
          <View style={styles.photoOverlay}>
            <View style={styles.photoChangeBadge}>
              <Ionicons name="pencil-outline" size={12} color="#fff" />
              <Text style={styles.photoChangeBadgeText}>Change</Text>
            </View>
          </View>
          <View style={styles.photoCheckBadge}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          </View>
        </>
      ) : (
        <View style={styles.photoSlotEmpty}>
          <View style={styles.photoIconWrap}>
            <Ionicons name={icon} size={30} color={colors.primary} />
          </View>
          <Text style={styles.photoSlotLabel}>{label}</Text>
          <Text style={styles.photoSlotHint}>Tap to upload</Text>
          <View style={styles.photoUploadActions}>
            <View style={styles.photoActionChip}>
              <Ionicons name="camera-outline" size={12} color={colors.primary} />
            </View>
            <View style={styles.photoActionDivider} />
            <View style={styles.photoActionChip}>
              <Ionicons name="images-outline" size={12} color={colors.primary} />
            </View>
          </View>
        </View>
      )}
    </Pressable>
  );
}

function TipCard({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.tipCard}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function RescuerVerificationScreen({ navigation, route }: any) {
  const [step, setStep] = useState(0);
  const [idType, setIdType] = useState('Barangay ID');
  const [idNumber, setIdNumber] = useState('');
  const [idFrontUri, setIdFrontUri] = useState('');
  const [idBackUri, setIdBackUri] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [idNumberFocused, setIdNumberFocused] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [activeSide, setActiveSide] = useState<IdSide | null>(null);
  const [isSliding, setIsSliding] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const idNumberInputRef = useRef<TextInput>(null);

  const goToStep = (next: number) => {
    setIsSliding(true);
    Animated.timing(slideAnim, {
      toValue: -400,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setStep(next);
      slideAnim.setValue(400);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start(() => {
        // Remount step content outside the native transform layer so TextInput
        // can open the soft keyboard (Android fails when focused under transform).
        setIsSliding(false);
      });
    });
  };

  const openModal = (side: IdSide) => {
    setActiveSide(side);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setActiveSide(null);
  };

  const pickPhoto = (side: IdSide) => {
    openModal(side);
  };

  const launchCamera = async (side: IdSide) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera Permission Required', 'Please allow camera access in your device settings to take a photo of your ID.');
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 10],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]?.base64) {
        const uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
        side === 'front' ? setIdFrontUri(uri) : setIdBackUri(uri);
      }
    } catch {
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };

  const launchGallery = async (side: IdSide) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Gallery Permission Required', 'Please allow gallery access in your device settings to pick a photo.');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 10],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]?.base64) {
        const uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
        side === 'front' ? setIdFrontUri(uri) : setIdBackUri(uri);
      }
    } catch {
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const handleSubmit = async () => {
    if (!idNumber.trim()) {
      Alert.alert('ID Number Required', 'Please enter your ID number to continue.');
      return;
    }
    if (!idFrontUri) {
      Alert.alert('Front Photo Required', 'Please upload or capture the front side of your ID.');
      return;
    }
    if (!idBackUri) {
      Alert.alert('Back Photo Required', 'Please upload or capture the back side of your ID.');
      return;
    }

    const email = route.params?.registrationData?.email;
    if (!email) {
      Alert.alert('Session Error', 'Could not find your account email. Please go back and try again.');
      return;
    }

    setSubmitting(true);
    try {
      // ── Step 1: Save to primary mobile app backend (port 3000) ───────────
      const response = await fetch(`${API_BASE_URL}/api/auth/rescuer-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          idType,
          idNumber: idNumber.trim(),
          idFrontUri,
          idBackUri,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('Submission Failed', data.error || 'Something went wrong. Please try again.');
        return;
      }

      // ── Step 2: Also register to the web dashboard backend (port 5000) ───
      // This makes the rescuer appear in the Barangay Admin Web at localhost:5173
      const reg = route.params?.registrationData;
      try {
        // webDashboardUrl synced to API_BASE_URL
        await fetch(`${API_BASE_URL}/api/rescuers/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            first_name: reg?.firstName || '',
            last_name: reg?.lastName || '',
            phone_number: reg?.contactNumber || reg?.phone || '',
            id_type: idType,
            id_number: idNumber.trim(),
          }),
        });
      } catch {
        // Silent fail — web dashboard might not be running, primary backend already saved the data
        console.warn('Web dashboard sync skipped (port 5000 not reachable).');
      }

      // ── Step 3: Show the waiting for approval modal ───────────────────────
      setShowWaitingModal(true);
    } catch (err) {
      Alert.alert('Network Error', 'Could not connect to the server. Make sure the backend is running and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const bothPhotosUploaded = !!idFrontUri && !!idBackUri;
  const selectedIdType = ID_TYPES.find(t => t.key === idType)!;

  const renderStep0 = () => (
    <View>
      <Text style={styles.stepHeading}>What type of ID do you have?</Text>
      <Text style={styles.stepSub}>
        Select the government-issued ID you'll use to verify your identity as a rescuer.
      </Text>
      <View style={styles.idTypeList}>
        {ID_TYPES.map((t) => (
          <IdTypeCard key={t.key} idType={t} selected={idType === t.key} onPress={() => setIdType(t.key)} />
        ))}
      </View>
      <TipCard icon="shield-checkmark-outline" text="Your ID is encrypted and only used to verify your rescuer credentials." />
    </View>
  );

  const renderStep1 = () => (
    <View>
      <Text style={styles.stepHeading}>Upload your {selectedIdType.label}</Text>
      <Text style={styles.stepSub}>
        Take clear, well-lit photos of both sides. Make sure all text is readable.
      </Text>

      <View style={styles.idNumberSection}>
        <Text style={[typography.eyebrow, styles.fieldLabel]}>ID Number</Text>
        <Pressable
          onPress={() => idNumberInputRef.current?.focus()}
          style={[styles.idNumberWrap, idNumberFocused && styles.idNumberWrapFocused]}
        >
          <Ionicons name={selectedIdType.icon} size={18} color={idNumberFocused ? colors.primary : colors.textSecondary} />
          <TextInput
            ref={idNumberInputRef}
            style={styles.idNumberInput}
            placeholder={`Enter your ${selectedIdType.label} number`}
            placeholderTextColor={colors.textMuted}
            value={idNumber}
            onChangeText={setIdNumber}
            autoCapitalize="characters"
            autoCorrect={false}
            editable
            showSoftInputOnFocus
            onFocus={() => setIdNumberFocused(true)}
            onBlur={() => setIdNumberFocused(false)}
          />
          {idNumber.length > 0 && (
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          )}
        </Pressable>
      </View>

      <Text style={[typography.eyebrow, styles.fieldLabel]}>ID Photos</Text>
      <View style={styles.photoSlotsRow}>
        <IdPhotoSlot side="front" uri={idFrontUri} onPress={pickPhoto} />
        <IdPhotoSlot side="back"  uri={idBackUri}  onPress={pickPhoto} />
      </View>

      <View style={styles.uploadProgress}>
        <View style={styles.uploadProgressBar}>
          <View
            style={[
              styles.uploadProgressFill,
              {
                width: `${
                  !idFrontUri && !idBackUri ? 0 :
                  idFrontUri && idBackUri ? 100 : 50
                }%`,
              },
            ]}
          />
        </View>
        <Text style={styles.uploadProgressText}>
          {!idFrontUri && !idBackUri
            ? '0 of 2 photos uploaded'
            : idFrontUri && idBackUri
            ? 'Both photos uploaded'
            : '1 of 2 photos uploaded'}
        </Text>
      </View>

      <View style={styles.tipsGroup}>
        <TipCard icon="sunny-outline"   text="Ensure good lighting — avoid shadows on the ID." />
        <TipCard icon="scan-outline"    text="Keep the ID flat and all 4 corners in frame." />
        <TipCard icon="eye-off-outline" text="Cover any non-required fields like your signature." />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          onPress={() => (step > 0 ? goToStep(step - 1) : navigation.goBack())}
          style={styles.backBtn}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.shieldBadge}>
            <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
          </View>
          <Text style={styles.headerTitle}>Rescuer Verification</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.stepIndicatorWrap}>
        <StepIndicator current={step} total={2} />
        <Text style={styles.stepCounter}>Step {step + 1} of 2</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {isSliding ? (
          <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
            {step === 0 ? renderStep0() : renderStep1()}
          </Animated.View>
        ) : (
          <View>
            {step === 0 ? renderStep0() : renderStep1()}
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        {step === 0 ? (
          <Pressable onPress={() => goToStep(1)} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        ) : submitting ? (
          <View style={[styles.primaryBtn, styles.primaryBtnLoading]}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.primaryBtnText}>Submitting…</Text>
          </View>
        ) : (
          <Pressable
            onPress={handleSubmit}
            style={[styles.primaryBtn, (!idNumber.trim() || !bothPhotosUploaded) && styles.primaryBtnDisabled]}
            disabled={!idNumber.trim() || !bothPhotosUploaded}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Submit for Review</Text>
          </Pressable>
        )}

        {step === 1 && (
          <Pressable onPress={() => navigation.navigate('Login')} style={styles.skipBtn}>
            <Text style={styles.skipBtnText}>Skip for now</Text>
          </Pressable>
        )}
      </View>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={styles.modalDragIndicator} />
              <Text style={styles.modalTitle}>
                Upload {activeSide === 'front' ? 'Front Side' : 'Back Side'}
              </Text>
              <Text style={styles.modalSubtitle}>
                Select a photo source to upload your ID
              </Text>
            </View>

            <View style={styles.modalOptions}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalOptionBtn,
                  pressed && styles.modalOptionBtnPressed,
                ]}
                onPress={() => {
                  if (activeSide) {
                    launchCamera(activeSide);
                  }
                  closeModal();
                }}
              >
                <View style={[styles.modalOptionIconWrap, { backgroundColor: '#FEF2F2' }]}>
                  <Ionicons name="camera-outline" size={24} color={colors.primary} />
                </View>
                <View style={styles.modalOptionTextWrap}>
                  <Text style={styles.modalOptionLabel}>Take Photo</Text>
                  <Text style={styles.modalOptionDesc}>Use your camera to snap a picture</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalOptionBtn,
                  pressed && styles.modalOptionBtnPressed,
                ]}
                onPress={() => {
                  if (activeSide) {
                    launchGallery(activeSide);
                  }
                  closeModal();
                }}
              >
                <View style={[styles.modalOptionIconWrap, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="images-outline" size={24} color="#15803D" />
                </View>
                <View style={styles.modalOptionTextWrap}>
                  <Text style={styles.modalOptionLabel}>Choose from Gallery</Text>
                  <Text style={styles.modalOptionDesc}>Pick an existing photo from your library</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.modalCancelBtn,
                pressed && styles.modalCancelBtnPressed,
              ]}
              onPress={closeModal}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <WaitingForApprovalModal
        visible={showWaitingModal}
        onClose={() => {
          setShowWaitingModal(false);
          navigation.navigate('Login');
        }}
        rescuerName={
          route.params?.registrationData
            ? [route.params.registrationData.firstName, route.params.registrationData.middleName, route.params.registrationData.lastName].filter(Boolean).join(' ')
            : 'Rescuer Applicant'
        }
        rescuerEmail={route.params?.registrationData?.email}
        idType={selectedIdType ? selectedIdType.label : idType}
        idNumber={idNumber}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const SLOT_H = 160;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.inactiveBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  shieldBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.textPrimary,
  },

  // Step indicator
  stepIndicatorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepRow: { flexDirection: 'row', gap: 6 },
  stepDot: { height: 4, borderRadius: 2 },
  stepDotActive:   { width: 24, backgroundColor: colors.primary },
  stepDotComplete: { width: 24, backgroundColor: colors.primary, opacity: 0.4 },
  stepDotInactive: { width: 12, backgroundColor: colors.border },
  stepCounter: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Scroll
  scroll: { flexGrow: 1, padding: 20, paddingBottom: 24 },

  // Step text
  stepHeading: {
    fontFamily: fontFamily.bold,
    fontSize: 22,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  stepSub: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
  },
  fieldLabel: { marginBottom: 10 },

  // ID Type Cards
  idTypeList: { gap: 10, marginBottom: 20 },
  idTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  idTypeCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  idTypeIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.inactiveBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idTypeIconWrapActive: { backgroundColor: 'rgba(224, 52, 43, 0.15)' },
  idTypeTextWrap: { flex: 1 },
  idTypeLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  idTypeLabelActive: { color: colors.primary },
  idTypeDesc: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: colors.textMuted,
  },
  idTypeRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idTypeRadioActive: { borderColor: colors.primary },
  idTypeRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },

  // ID Number
  idNumberSection: { marginBottom: 20 },
  idNumberWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
  },
  idNumberWrapFocused: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  idNumberInput: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    fontFamily: fontFamily.medium,
    fontSize: 15,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },

  // Photo Slots
  photoSlotsRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  photoSlot: {
    flex: 1,
    height: SLOT_H,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    position: 'relative',
  },
  photoSlotUploaded: {
    borderStyle: 'solid',
    borderColor: colors.success,
  },
  photoPreview: { width: '100%', height: '100%' },
  photoOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 8,
  },
  photoChangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  photoChangeBadgeText: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    color: '#fff',
  },
  photoCheckBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 11,
  },
  photoSlotEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 6,
  },
  photoIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  photoSlotLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  photoSlotHint: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: colors.textMuted,
  },
  photoUploadActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  photoActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  photoActionChipText: {
    fontFamily: fontFamily.semibold,
    fontSize: 10,
    color: colors.primary,
  },
  photoActionDivider: {
    width: 1,
    height: 12,
    backgroundColor: colors.border,
  },

  // Upload Progress
  uploadProgress: { marginBottom: 20, gap: 6 },
  uploadProgressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  uploadProgressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.success,
  },
  uploadProgressText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Tips
  tipsGroup: { gap: 8 },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(224, 52, 43, 0.15)',
  },
  tipText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: '#991B1B',
    lineHeight: 17,
  },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingBottom: Platform.OS === 'ios' ? 8 : 14,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  primaryBtnLoading: { backgroundColor: colors.primaryDark },
  primaryBtnDisabled: { backgroundColor: '#EDAAAA' },
  primaryBtnText: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: '#fff',
  },
  skipBtn: { alignItems: 'center', paddingVertical: 6 },
  skipBtnText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: colors.textSecondary,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalDragIndicator: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  modalOptions: {
    gap: 12,
    marginBottom: 16,
  },
  modalOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalOptionBtnPressed: {
    backgroundColor: colors.inactiveBg,
    borderColor: colors.textSecondary,
  },
  modalOptionIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  modalOptionTextWrap: {
    flex: 1,
  },
  modalOptionLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  modalOptionDesc: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  modalCancelBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inactiveBg,
    marginTop: 8,
  },
  modalCancelBtnPressed: {
    opacity: 0.8,
  },
  modalCancelText: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.textPrimary,
  },
});
