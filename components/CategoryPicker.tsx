'use client';

import CategoryIcon from './CategoryIcon';
import { CATEGORIES } from '@/lib/config';
import { useI18n } from '@/lib/i18n';
import type { CategoryId } from '@/lib/types';

/**
 * Four across, two rows — every option visible without scrolling, which
 * matters a lot for someone using a phone form for the first time.
 */
export default function CategoryPicker({
  value,
  onChange,
}: {
  value: CategoryId | null;
  onChange: (id: CategoryId) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-4 gap-2">
      {CATEGORIES.map((cat) => {
        const selected = value === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(cat.id)}
            aria-pressed={selected}
            className={
              'flex flex-col items-center gap-1.5 rounded-2xl border-2 px-1 py-2.5 text-center transition active:scale-[0.97] ' +
              (selected ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white')
            }
          >
            <CategoryIcon id={cat.id} size="sm" />
            <span className="text-[10px] font-semibold leading-tight text-slate-700">
              {t('category.' + cat.id)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
