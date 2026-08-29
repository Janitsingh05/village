'use client';

import Icon from './Icon';
import { useI18n } from '@/lib/i18n';
import { useVillage } from '@/lib/village-context';

/**
 * Who the villagers should approach.
 *
 * A complaint feed is impersonal; putting a face and a name on it tells a
 * resident there is a specific person on the other end. Shown only once the
 * admin has actually filled their profile in — an empty card would say less
 * than nothing.
 */
export default function SarpanchCard() {
  const { t } = useI18n();
  const { village } = useVillage();

  if (!village?.adminName) return null;

  const phone = village.adminPhone;

  return (
    <section className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-card">
      {village.adminPhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={village.adminPhotoUrl}
          alt={village.adminName}
          className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-brand-100"
        />
      ) : (
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
          <Icon name="user" className="h-8 w-8" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">
          {t('village.yourSarpanch')}
        </p>
        <p className="truncate text-base font-bold text-slate-900">{village.adminName}</p>
        {village.adminRole && (
          <p className="truncate text-sm text-slate-500">{village.adminRole}</p>
        )}
      </div>

      {phone && (
        <a
          href={'tel:' + phone}
          aria-label={t('village.contact')}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-600 text-white transition active:scale-95"
        >
          <Icon name="user" className="h-5 w-5" />
        </a>
      )}
    </section>
  );
}
