import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppIcon, colors, radius, shadows, spacing, typography } from '@isla/ui';

export type ChatMessage = { id: string; body: string; created_at: string; sender_id: string };

export type ConversationAccent = { main: string; soft: string; deep: string };

/**
 * Messenger-style per-conversation theme. A stable hash of the thread key
 * (order id / merchant+customer pair) picks one of eight saturated colors,
 * so every chat is instantly recognizable. The same accent drives the
 * header avatar, own bubbles, send button, list avatars, and unread dots.
 */
const ACCENTS: ConversationAccent[] = [
  { main: '#0084FF', soft: '#E7F3FF', deep: '#0068C8' }, // Messenger blue
  { main: '#7B61FF', soft: '#EFEBFF', deep: '#5A3EE0' }, // purple
  { main: '#D63384', soft: '#FBE9F2', deep: '#A42363' }, // magenta
  { main: '#E53935', soft: '#FDECEA', deep: '#B3261E' }, // red
  { main: '#EF6C00', soft: '#FFF1E0', deep: '#B75300' }, // orange
  { main: '#009688', soft: '#DFF2EF', deep: '#00695C' }, // teal
  { main: '#43A047', soft: '#E7F4E8', deep: '#2E7B32' }, // green
  { main: '#3949AB', soft: '#E8EBFA', deep: '#283593' }, // indigo
];

export function conversationColor(key: string): ConversationAccent {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return ACCENTS[hash % ACCENTS.length] ?? ACCENTS[0]!;
}

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

/** Messenger-like circular avatar: white initial on the conversation accent. */
export function ThreadAvatar({
  initial,
  accent,
  size = 40,
}: {
  initial: string;
  accent: ConversationAccent;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: accent.main },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>
        {(initial.trim().charAt(0) || '?').toUpperCase()}
      </Text>
    </View>
  );
}

/** One-shot fade-and-rise so new messages land smoothly (native driver). */
function AnimatedRow({ children }: { children: ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 170, useNativeDriver: true }).start();
  }, [anim]);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const BUBBLE_RADIUS = 18;
const GROUP_RADIUS = 5;

/**
 * Messenger thread: day dividers as plain centered text, grouped bubbles
 * with flattened facing corners, counterpart avatar on the last message of
 * each incoming group, and a small timestamp under each group.
 */
export function ChatThread({
  messages,
  myId,
  accent,
  theirInitial = '?',
}: {
  messages: ChatMessage[];
  myId: string;
  accent: ConversationAccent;
  theirInitial?: string;
}) {
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
          !!prev && prev.sender_id === m.sender_id && +new Date(m.created_at) - +new Date(prev.created_at) < GROUP_WINDOW_MS;
        const groupedNext =
          !!next && next.sender_id === m.sender_id && +new Date(next.created_at) - +new Date(m.created_at) < GROUP_WINDOW_MS;
        const groupLast = !groupedNext;
        return (
          <AnimatedRow key={m.id}>
            {showDay ? (
              <View style={styles.dayRow}>
                <Text style={styles.dayText}>{day}</Text>
              </View>
            ) : null}
            <View
              style={[
                styles.row,
                mine ? styles.rowMine : styles.rowTheirs,
                groupedPrev ? styles.rowGrouped : styles.rowFresh,
              ]}
            >
              {!mine ? (
                <View style={styles.theirAvatarSlot}>
                  {groupLast ? <ThreadAvatar initial={theirInitial} accent={accent} size={28} /> : null}
                </View>
              ) : null}
              <View style={styles.bubbleCol}>
                <View
                  style={[
                    styles.bubble,
                    mine
                      ? { backgroundColor: accent.main }
                      : { backgroundColor: colors.surfaceSunken },
                    mine && groupedPrev && { borderTopRightRadius: GROUP_RADIUS },
                    mine && groupedNext && { borderBottomRightRadius: GROUP_RADIUS },
                    !mine && groupedPrev && { borderTopLeftRadius: GROUP_RADIUS },
                    !mine && groupedNext && { borderBottomLeftRadius: GROUP_RADIUS },
                  ]}
                >
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.body}</Text>
                </View>
                {groupLast ? (
                  <View style={[styles.metaRow, mine ? styles.metaMine : styles.metaTheirs]}>
                    <Text style={styles.bubbleTime}>{clock(m.created_at)}</Text>
                    {mine ? <AppIcon name="check" size={12} color="rgba(255,255,255,0.85)" /> : null}
                  </View>
                ) : null}
              </View>
            </View>
          </AnimatedRow>
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
  accent,
}: {
  onSend: (body: string) => Promise<void> | void;
  sending: boolean;
  placeholder?: string;
  accent: ConversationAccent;
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
          { backgroundColor: accent.main },
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
  avatar: { alignItems: 'center', justifyContent: 'center', ...shadows.card },
  avatarText: { color: colors.onPrimary, fontWeight: '800' },
  dayRow: { alignItems: 'center', marginVertical: spacing.sm },
  dayText: { ...typography.micro, color: colors.faint, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  rowFresh: { marginTop: spacing.sm },
  rowGrouped: { marginTop: 3 },
  theirAvatarSlot: { width: 32, alignItems: 'center', justifyContent: 'flex-end', marginRight: 5 },
  bubbleCol: { maxWidth: '78%', gap: 2 },
  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: BUBBLE_RADIUS,
    ...shadows.card,
  },
  bubbleText: { ...typography.body, color: colors.text },
  bubbleTextMine: { color: colors.onPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 4 },
  metaMine: { justifyContent: 'flex-end' },
  metaTheirs: { justifyContent: 'flex-start' },
  bubbleTime: { ...typography.micro, fontSize: 10, color: colors.faint },

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
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  sendIdle: { opacity: 0.45 },
  sendDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
});
