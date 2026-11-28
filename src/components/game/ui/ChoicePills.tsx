/**
 * Dokunsal seçim hapları: ham `<select>` açılır kutusunun yerine geçer (g-choice).
 * Kapsayıcı eski açılır kutunun `data-testid` değerini taşır; her seçenek `<testid>-<değer>` kimliği alır.
 */
import React from 'react';

export interface ChoicePillOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
  sub?: React.ReactNode;
}

export interface ChoicePillsProps<T extends string | number> {
  options: ReadonlyArray<ChoicePillOption<T>>;
  value: T;
  onChange: (value: T) => void;
  testId?: string;
  ariaLabel?: string;
  /** Sütun sayısı (varsayılan 2) */
  columns?: 1 | 2 | 3 | 4 | 5;
}

const COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
};

export function ChoicePills<T extends string | number>({
  options,
  value,
  onChange,
  testId,
  ariaLabel,
  columns = 2,
}: ChoicePillsProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-testid={testId}
      data-value={String(value)}
      className={`grid ${COLS[columns]} gap-2`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            data-active={active ? 'true' : 'false'}
            data-testid={testId ? `${testId}-${String(o.value)}` : undefined}
            onClick={() => onChange(o.value)}
            className="g-choice px-2 py-1.5 text-[13px] leading-tight"
          >
            <span className="block">{o.label}</span>
            {o.sub && <span className="block text-[12px] font-semibold opacity-75 tabular-nums">{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}
