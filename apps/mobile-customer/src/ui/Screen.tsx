import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from './theme';

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  keyboard?: boolean;
}>;

export function Screen({ children, scroll = true, keyboard = true }: ScreenProps) {
  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, styles.content]}>{children}</View>
  );

  const wrapped = keyboard ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {body}
    </KeyboardAvoidingView>
  ) : (
    body
  );

  return <SafeAreaView style={styles.flex}>{wrapped}</SafeAreaView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, gap: 16 },
});