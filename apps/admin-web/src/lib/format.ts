import { isAllTowns, isNoTowns, TOWN_LABELS, type Town } from '@isla/shared';

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "All municipalities", "Boac, Torrijos" or an em dash when nothing is set. */
export function townSummary(towns: Town[] | null | undefined): string {
  if (isNoTowns(towns)) return '—';
  if (isAllTowns(towns)) return 'All municipalities';
  return (towns ?? []).map((t) => TOWN_LABELS[t]).join(', ');
}

export function townName(town: Town | null | undefined): string {
  return town ? TOWN_LABELS[town] : '—';
}
