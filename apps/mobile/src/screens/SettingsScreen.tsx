import { StyleSheet, Text, View } from 'react-native';
import { Screen, ScreenHeader, SectionHeader, colors, spacing, typography } from '@isla/ui';
import { SoundSettingsForm } from '../components/SoundSettings';
import { BottomNav, BOTTOM_NAV_HEIGHT } from '../components/BottomNav';
import type { RootNavProp, RootStackScreen } from '../navigation/types';
import { useNavigation } from '@react-navigation/native';

type Props = RootStackScreen<'Settings'>;

export default function SettingsScreen({}: Props) {
  const navigation = useNavigation<RootNavProp>();
  return (
    <Screen footer={<BottomNav />} footerHeight={BOTTOM_NAV_HEIGHT}>
      <ScreenHeader title="Sounds & alerts" onBack={() => navigation.goBack()} />
      <Text style={styles.lead}>Choose which moments make noise. Banners still appear silently when sound is off.</Text>
      <View style={styles.section}>
        <SectionHeader title="Notifications" />
        <SoundSettingsForm role="customer" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { ...typography.body, color: colors.muted },
  section: { gap: spacing.md },
});
