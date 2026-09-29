import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppIcon, colors, radius, shadows, spacing, typography } from '@isla/ui';
import type { MessageRow } from './chat';

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Day dividers + grouped bubbles with tails, ticks and inline timestamps. */
export function ChatThread({ messages, myId }: { messages: MessageRow[]; myId: string }) {
  let lastDay = '';
  return (
    <>
      {messages.map((m, i) => {
        const day = dayLabel(m.created_at);
        const showDay = day !== lastDay;
        lastDay = day;
        const mine = m.sender_id === myId;
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const groupedPrev =
          !!prev && prev.sender_id === m.sender_id && +new Date(m.created_at) - +new Date(prev.created_at) < 5 * 60 * 1000;
        const groupedNext =
          !!next && next.sender_id === m.sender_id && +new Date(next.created_at) - +new Date(m.created_at) < 5 * 60 * 1000;
        return (
          <View key={m.id}>
            {showDay ? (
              <View style={styles.dayRow}>
                <View style={styles.dayPill}>
                  <Text style={styles.dayText}>{day}</Text>
                </View>
              </View>
            ) : null}
            <View
              style={[
                styles.row,
                mine ? styles.rowMine : styles.rowTheirs,
                groupedPrev ? styles.rowGrouped : styles.rowFresh,
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  mine ? styles.bubbleMine : styles.bubbleTheirs,
                  mine && !groupedNext && styles.tailMine,
                  !mine && !groupedNext && styles.tailTheirs,
                ]}
              >
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.body}</Text>
                {!groupedNext ? (
                  <View style={styles.metaRow}>
                    <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>{clock(m.created_at)}</Text>
                    {mine ? <AppIcon name="check" size={12} color="rgba(255,255,255,0.8)" /> : null}
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        );
      })}
    </>
  );
}

export function ChatEmptyState({ orderNumber }: { orderNumber?: string }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <AppIcon name="chat" size={30} color={colors.primaryDeep} />
      </View>
      <Text style={styles.emptyTitle}>Say hello</Text>
      <Text style={styles.emptyBody}>Coordinate pickup, landmarks, or item swaps with each other here.</Text>
      {orderNumber ? (
        <View style={styles.emptyChip}>
          <Text style={styles.emptyChipText}>Order #{orderNumber}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function ChatComposer({
  onSend,
  sending,
  placeholder = 'Write a message…',
}: {
  onSend: (body: string) => Promise<void> | void;
  sending: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const submit = () => {
    const body = draft.trim();
    if (!body || sending) return;
    setDraft('');
    void onSend(body);
  };
  return (
    <View style={styles.composer}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        multiline
        maxLength={2000}
        style={styles.input}
        returnKeyType="send"
        onSubmitEditing={submit}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send message"
        onPress={submit}
        disabled={!draft.trim() || sending}
        style={({ pressed }) => [
          styles.send,
          !draft.trim() && styles.sendIdle,
          sending && styles.sendDisabled,
          pressed && styles.pressed,
        ]}
      >
        <AppIcon name="send" size={19} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  dayRow: { alignItems: 'center', marginVertical: spacing.sm },
  dayPill: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    ...shadows.card,
  },
  dayText: { ...typography.micro, color: colors.muted, fontWeight: '700' },
  row: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  rowFresh: { marginTop: spacing.sm },
  rowGrouped: { marginTop: 3 },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    gap: 3,
  },
  bubbleMine: { backgroundColor: colors.primaryDeep, ...shadows.card },
  bubbleTheirs: { backgroundColor: colors.surface, ...shadows.card },
  tailMine: { borderBottomRightRadius: radius.xs },
  tailTheirs: { borderBottomLeftRadius: radius.xs },
  bubbleText: { ...typography.body, color: colors.text },
  bubbleTextMine: { color: colors.onPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  bubbleTime: { ...typography.micro, fontSize: 10, color: colors.faint },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.75)' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.raised,
  },
  emptyTitle: { ...typography.title, fontSize: 20 },
  emptyBody: { ...typography.body, textAlign: 'center' },
  emptyChip: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  emptyChipText: { ...typography.micro, color: colors.primaryDeep, fontWeight: '700' },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.sm,
    paddingLeft: spacing.base,
    ...shadows.raised,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 110,
    paddingVertical: spacing.xs,
    ...typography.body,
    color: colors.text,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  sendIdle: { backgroundColor: colors.primary },
  sendDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
});
