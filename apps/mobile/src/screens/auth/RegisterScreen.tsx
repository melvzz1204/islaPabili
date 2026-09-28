import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { isReservedAuthEmail, isValidUsername, normalizeUsername } from '@isla/shared';
import { isUsernameTaken, signUpWithPassword, useAuth } from '@isla/supabase';
import {
  AuthHeader,
  Badge,
  Button,
  Card,
  OrDivider,
  PasswordField,
  Screen,
  ScreenHeader,
  TextField,
  TextLink,
  colors,
  radius,
  spacing,
  typography,
  useToast,
} from '@isla/ui';
import { TermsAcceptanceRow, TermsModal, type TermsDoc } from '../../components/TermsAndConditions';
import { RolePicker } from '../../components/RolePicker';
import { useAuthMode } from '../../lib/authMode';
import type { RootNavProp } from '../../navigation/types';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken';

function passwordScore(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
}

const STRENGTH_META = [
  { label: '', color: colors.border },
  { label: 'Weak', color: colors.danger },
  { label: 'Fair', color: colors.warn },
  { label: 'Good', color: colors.primary },
  { label: 'Strong', color: colors.success },
];

export default function RegisterScreen() {
  const { client } = useAuth();
  const { showToast } = useToast();
  const navigation = useNavigation<RootNavProp>();
  const { mode, setMode } = useAuthMode();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsDoc, setTermsDoc] = useState<TermsDoc | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');

  const touch = (key: string) => setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));

  const cleanEmail = email.trim();
  const nameError = touched.fullName && fullName.trim().length < 2 ? 'Please enter your full name.' : null;
  const usernameError =
    touched.username && username.length > 0 && !isValidUsername(username)
      ? 'Use 3-20 characters: letters, numbers, underscores.'
      : touched.username && usernameStatus === 'taken'
        ? 'That username is taken. Try another one.'
        : null;
  const emailError =
    touched.email && cleanEmail && !cleanEmail.includes('@')
      ? 'That email address looks invalid.'
      : touched.email && cleanEmail && isReservedAuthEmail(cleanEmail)
        ? 'That email domain is reserved.'
        : null;
  const passwordError =
    touched.password && password.length > 0 && password.length < 8
      ? 'Password must be at least 8 characters.'
      : null;
  const confirmError =
    touched.confirm && confirm.length > 0 && password !== confirm ? "Passwords don't match." : null;

  const strength = passwordScore(password);
  const strengthMeta = STRENGTH_META[strength] ?? STRENGTH_META[0];

  const checkUsername = async () => {
    touch('username');
    if (!isValidUsername(username)) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    const taken = await isUsernameTaken(client, username);
    setUsernameStatus(taken ? 'taken' : 'available');
  };

  const handleRegister = async () => {
    if (!acceptedTerms) {
      showToast({
        message: 'Please read and accept the Terms and Conditions to create your account.',
        type: 'error',
      });
      return;
    }
    if (fullName.trim().length < 2) {
      showToast({ message: 'Please enter your full name.', type: 'error' });
      return;
    }
    if (!isValidUsername(username)) {
      showToast({
        message: 'Username must be 3-20 characters: letters, numbers, underscores.',
        type: 'error',
      });
      return;
    }
    if (cleanEmail && !cleanEmail.includes('@')) {
      showToast({ message: 'That email address looks invalid.', type: 'error' });
      return;
    }
    if (cleanEmail && isReservedAuthEmail(cleanEmail)) {
      showToast({ message: 'That email domain is reserved.', type: 'error' });
      return;
    }
    if (password.length < 8) {
      showToast({ message: 'Password must be at least 8 characters.', type: 'error' });
      return;
    }
    if (password !== confirm) {
      showToast({ message: "Passwords don't match.", type: 'error' });
      return;
    }
    setSubmitting(true);
    if (await isUsernameTaken(client, username)) {
      setSubmitting(false);
      setUsernameStatus('taken');
      showToast({ message: 'That username is taken. Try another one.', type: 'error' });
      return;
    }
    const { error } = await signUpWithPassword(client, {
      username,
      email: cleanEmail || undefined,
      password,
      fullName: fullName.trim(),
    });
    setSubmitting(false);
    if (error) {
      Alert.alert('Sign up failed', error);
      return;
    }
    const { data } = await client.auth.getSession();
    showToast({
      message: data.session
        ? `Welcome to IslaPabili, ${normalizeUsername(username)}!`
        : 'Account created! Check your email to confirm it.',
      type: 'success',
    });
  };

  return (
    <Screen background={colors.primaryTint}>
      <ScreenHeader title="" onBack={() => navigation.goBack()} />

      <AuthHeader
        icon="pabili"
        accent
        align="center"
        title="Create your account"
        subtitle="A minute to sign up — you'll pick your town in the next step."
      />

      <View style={styles.stepper}>
        <Text style={styles.stepperLabel}>Step 1 of 2 · Account details</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { flex: 1 }]} />
          <View style={{ flex: 1 }} />
        </View>
      </View>

      <RolePicker value={mode} onChange={setMode} />

      <Card>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Your profile</Text>
          <Badge label="1 min" status="pending" />
        </View>
        <TextField
          label="Full name"
          placeholder="Juan Dela Cruz"
          autoComplete="name"
          value={fullName}
          onChangeText={setFullName}
          onBlur={() => touch('fullName')}
          error={nameError}
          fieldStyle={styles.field}
        />
        <TextField
          label="Username"
          placeholder="juan_dela_cruz"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username-new"
          value={username}
          onChangeText={(v) => {
            setUsername(v);
            setUsernameStatus('idle');
          }}
          onBlur={() => void checkUsername()}
          error={usernameError}
          fieldStyle={styles.field}
        />
        {usernameStatus === 'checking' ? (
          <Text style={styles.checkHint}>Checking availability…</Text>
        ) : usernameStatus === 'available' ? (
          <Text style={styles.availableHint}>Available</Text>
        ) : null}
        <TextField
          label="Email (optional)"
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          onBlur={() => touch('email')}
          error={emailError}
          fieldStyle={styles.field}
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Security</Text>
        <PasswordField
          placeholder="At least 8 characters"
          value={password}
          onChangeText={setPassword}
          onBlur={() => touch('password')}
          error={passwordError}
          fieldStyle={styles.field}
        />
        {password.length > 0 ? (
          <View style={styles.strengthRow}>
            <View style={styles.strengthTrack}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.strengthSeg,
                    { backgroundColor: i < strength ? strengthMeta.color : colors.border },
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.strengthLabel, { color: strengthMeta.color }]}>
              {strengthMeta.label}
            </Text>
          </View>
        ) : null}
        <PasswordField
          label="Confirm password"
          placeholder="Repeat your password"
          value={confirm}
          onChangeText={setConfirm}
          onBlur={() => touch('confirm')}
          error={confirmError}
          fieldStyle={styles.field}
        />
      </Card>

      <Card style={styles.termsCard}>
        <Badge label={acceptedTerms ? 'Accepted' : 'Required'} status={acceptedTerms ? 'delivered' : 'pending'} />
        <TermsAcceptanceRow
          accepted={acceptedTerms}
          onToggle={() => setAcceptedTerms((prev) => !prev)}
          onOpen={(doc) => setTermsDoc(doc)}
        />
        <Button
          title="Create account"
          style={styles.pill}
          onPress={() => void handleRegister()}
          loading={submitting}
          disabled={!acceptedTerms}
        />
        <Text style={styles.finePrint}>
          You must accept the Terms and Conditions before creating an account.
        </Text>
      </Card>
      <TermsModal
        doc={termsDoc}
        onClose={() => setTermsDoc(null)}
        onAccept={() => {
          setAcceptedTerms(true);
          setTermsDoc(null);
        }}
      />

      <OrDivider label="Already have an account?" />
      <TextLink label="Log in instead" onPress={() => navigation.navigate('Login')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stepper: { gap: spacing.xs },
  stepperLabel: { ...typography.micro, fontWeight: '700', letterSpacing: 1 },
  track: { flexDirection: 'row', height: 8, borderRadius: radius.full, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { backgroundColor: colors.accent, borderRadius: radius.full },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { ...typography.heading, fontSize: 16 },
  checkHint: { ...typography.caption },
  availableHint: { ...typography.caption, color: colors.success, fontWeight: '600' },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  strengthTrack: { flex: 1, flexDirection: 'row', gap: spacing.xs },
  strengthSeg: { flex: 1, height: 6, borderRadius: radius.full },
  strengthLabel: { fontSize: 12, fontWeight: '700', minWidth: 52, textAlign: 'right' },
  termsCard: { borderColor: colors.primary, borderWidth: 1.5, alignItems: 'flex-start' },
  finePrint: { ...typography.caption, textAlign: 'center', alignSelf: 'center' },
  field: {
    backgroundColor: colors.surfaceSunken,
    borderColor: 'transparent',
    borderRadius: radius.pill,
  },
  pill: { borderRadius: radius.pill },
});
