import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Guest → login handoff for a pabili list, mirrors `checkoutReturn.ts`.
 *
 * A guest can fill the whole list; submitting only needs an account. We stash
 * the draft, ask them to sign in, then the logged-in stack reopens
 * PabiliCreate (see App.tsx) and the screen restores the draft from storage so
 * nothing typed is lost.
 */
let returnToPabili = false;

export function requestPabiliReturn() {
  returnToPabili = true;
}

export function consumePabiliReturn(): boolean {
  const v = returnToPabili;
  returnToPabili = false;
  return v;
}

/** Everything a guest could have typed, minus device-local photo URIs. */
export type PabiliDraft = {
  rows: { name: string; qty: string }[];
  name: string;
  phone: string;
  town: string | null;
  address: string;
  storePick: string | null;
  customStore: string;
};

const DRAFT_KEY = 'islapabili_pabili_draft_v1';

function sanitizeDraft(raw: unknown): PabiliDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<PabiliDraft>;
  const rows = Array.isArray(r.rows)
    ? r.rows
        .filter(
          (x): x is { name: string; qty: string } =>
            !!x && typeof x.name === 'string' && typeof x.qty === 'string',
        )
        .map((x) => ({ name: x.name, qty: x.qty }))
    : [];
  return {
    rows: rows.length > 0 ? rows : [{ name: '', qty: '1' }],
    name: typeof r.name === 'string' ? r.name : '',
    phone: typeof r.phone === 'string' ? r.phone : '',
    town: typeof r.town === 'string' ? r.town : null,
    address: typeof r.address === 'string' ? r.address : '',
    storePick: typeof r.storePick === 'string' ? r.storePick : null,
    customStore: typeof r.customStore === 'string' ? r.customStore : '',
  };
}

export async function savePabiliDraft(draft: PabiliDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Non-fatal: the guest re-enters their list after logging in.
  }
}

export async function loadPabiliDraft(): Promise<PabiliDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return sanitizeDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function clearPabiliDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch {
    // Non-fatal.
  }
}
