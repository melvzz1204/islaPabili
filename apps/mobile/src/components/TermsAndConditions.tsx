import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Checkbox, SheetModal, colors, spacing, typography } from '@isla/ui';

export type TermsDoc = 'terms' | 'privacy';

export const TERMS_TITLE = 'Terms and Conditions';
export const PRIVACY_TITLE = 'Privacy Policy';
export const TERMS_VERSION = 'Dummy v1.0 — for demo purposes only';

type Section = { heading: string; body: string };

export const TERMS_SECTIONS: Section[] = [
  {
    heading: '1. Acceptance of terms',
    body: 'By creating an IslaPabili account you agree to these dummy Terms and Conditions. This is placeholder text for development and demo builds — it does not constitute legal advice and will be replaced with the final legal copy before production launch.',
  },
  {
    heading: '2. Your account',
    body: 'You must provide accurate information when registering (name, username, contact details). You are responsible for keeping your password confidential and for all activity under your account. You must be at least 18 years old, or have a parent/guardian’s consent, to use IslaPabili.',
  },
  {
    heading: '3. Orders, pabili & delivery',
    body: 'IslaPabili connects customers with riders for pabili errands and doorstep delivery around Marinduque. Prices, fees, and estimated times shown in the app are indicative and may change due to store availability, distance, or weather. Riders may decline unsafe or unlawful requests.',
  },
  {
    heading: '4. Payments & refunds',
    body: 'Dummy policy: payments shown in demo builds are simulated. In production, cash-on-delivery and supported e-payments will be subject to the payment provider’s terms. Refunds or re-delivery for missing/damaged items follow the in-app support process.',
  },
  {
    heading: '5. Acceptable use',
    body: 'You agree not to misuse the app, attempt to disrupt the service, submit false orders, harass riders or other users, or use IslaPabili for unlawful goods or activities. Violations may lead to suspension of your account.',
  },
  {
    heading: '6. Changes & termination',
    body: 'We may update these terms and the app at any time. Continued use after changes means you accept the updated terms. You may delete your account anytime from support; we may suspend accounts that violate these terms.',
  },
];

export const PRIVACY_SECTIONS: Section[] = [
  {
    heading: '1. Data we collect',
    body: 'Dummy policy: we collect account details (name, username, email/phone), delivery addresses and town, order history, and basic device data needed to run the app.',
  },
  {
    heading: '2. How we use data',
    body: 'We use your data to create your account, match you with riders, process deliveries, provide support, and improve IslaPabili. We do not sell your personal information.',
  },
  {
    heading: '3. Sharing',
    body: 'Your order details (name, delivery address, phone) are shared with the assigned rider so they can fulfil your delivery. Aggregated, anonymized analytics may be shared with service providers.',
  },
  {
    heading: '4. Your choices',
    body: 'You may update your profile information in the app and request account deletion via support. Demo builds may reset data at any time.',
  },
];

export function TermsModal({
  doc,
  onClose,
  onAccept,
}: {
  doc: TermsDoc | null;
  onClose: () => void;
  onAccept: () => void;
}) {
  const title = doc === 'privacy' ? PRIVACY_TITLE : TERMS_TITLE;
  const sections = doc === 'privacy' ? PRIVACY_SECTIONS : TERMS_SECTIONS;

  return (
    <SheetModal
      visible={doc !== null}
      title={title}
      subtitle={TERMS_VERSION}
      onClose={onClose}
      footer={<Button title="I understand" onPress={onAccept} />}
    >
      <ScrollView contentContainerStyle={styles.bodyContent}>
        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SheetModal>
  );
}

export function TermsAcceptanceRow({
  accepted,
  onToggle,
  onOpen,
}: {
  accepted: boolean;
  onToggle: () => void;
  onOpen: (doc: TermsDoc) => void;
}) {
  return (
    <View style={styles.row}>
      <Checkbox checked={accepted} onToggle={onToggle} label="Accept Terms and Conditions" />
      <Text style={styles.rowText}>
        I agree to the{' '}
        <Text style={styles.link} onPress={() => onOpen('terms')}>
          Terms and Conditions
        </Text>{' '}
        and{' '}
        <Text style={styles.link} onPress={() => onOpen('privacy')}>
          Privacy Policy
        </Text>
        .
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bodyContent: { gap: spacing.md, paddingBottom: spacing.sm },
  section: { gap: spacing.xs },
  sectionHeading: { ...typography.subhead, fontWeight: '600' },
  sectionBody: { ...typography.body, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  rowText: { flex: 1, ...typography.body, lineHeight: 20 },
  link: { color: colors.primary, fontWeight: '600', textDecorationLine: 'underline' },
});
