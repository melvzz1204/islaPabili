import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, Screen, spacing } from '@isla/ui';
import { HowItWorks } from '../components/HowItWorks';
import type { RootNavProp, TabScreen } from '../navigation/types';

type Props = TabScreen<'Shop'>;

/**
 * Guest landing: mirrors the Figma prototype (Login/Register top-right,
 * "How it works?" timeline, big Create Pabili List CTA). No stores listed.
 */
export default function LandingScreen({}: Props) {
  const navigation = useNavigation<RootNavProp>();

  return (
    <Screen edges={['top']}>
      <View style={styles.topRow}>
        <View style={styles.spacer} />
        <Button
          title="Login/Register"
          variant="soft"
          size="md"
          fullWidth={false}
          onPress={() => navigation.navigate('AuthHome')}
        />
      </View>

      <HowItWorks onCreate={() => navigation.navigate('PabiliCreate')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  spacer: { flex: 1 },
});
