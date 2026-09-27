import { useMemo } from 'react';
import {
  SUPPORTED_TOWNS,
  TOWN_LABELS,
  isAllTowns,
  isNoTowns,
  townSelectionLabel,
  type Town,
} from '@isla/shared';
import { MultiSelect, OptionPicker } from '@isla/ui';

type TownPickerProps = {
  /** Municipalities the customer opted into. Empty means nothing chosen yet. */
  value: Town[];
  onChange: (towns: Town[]) => void;
};

const OPTIONS = SUPPORTED_TOWNS.map((town) => ({ value: town, label: TOWN_LABELS[town] }));

type SingleTownPickerProps = {
  value: Town | null;
  onChange: (town: Town) => void;
  /** `list` renders inline chips; `field` renders a single tappable row. */
  variant?: 'list' | 'field';
  placeholder?: string;
};

/**
 * Single-town variant for flows that only ever need one town: a rider's
 * operating area, or the delivery town at checkout.
 */
export function SingleTownPicker({
  value,
  onChange,
  variant = 'list',
  placeholder = 'Select your town',
}: SingleTownPickerProps) {
  return (
    <OptionPicker
      variant={variant}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      options={OPTIONS}
    />
  );
}

/**
 * Domain wrapper for the town opt-in picker: every municipality is selectable
 * and an "All" shortcut selects them all. "All" is stored as the full set of
 * towns rather than a sentinel, so filtering stays a simple membership test.
 */
export function TownPicker({ value, onChange }: TownPickerProps) {
  const summary = useMemo(() => {
    if (isNoTowns(value)) return 'Pick at least one municipality to browse.';
    return isAllTowns(value)
      ? 'You will see stores from every municipality.'
      : townSelectionLabel(value);
  }, [value]);

  return (
    <MultiSelect
      value={value}
      onChange={onChange}
      options={OPTIONS}
      selectAllLabel="All"
      summary={summary}
    />
  );
}
