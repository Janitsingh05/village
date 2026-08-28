'use client';

import Link from 'next/link';
import Icon from './Icon';
import CategoryIcon from './CategoryIcon';
import StatusBadge from './StatusBadge';
import { categoryOf, wardLabel } from '@/lib/config';
import { useI18n } from '@/lib/i18n';
import { shortDate } from '@/lib/format';
import type { Complaint } from '@/lib/types';

export default function ComplaintCard({
  complaint,
  href,
}: {
  complaint: Complaint;
  href?: string;
}) {
  const { lang, t } = useI18n();
  const cat = categoryOf(complaint.category);
  const ward = wardLabel(complaint.location.ward, lang);

  return (
    <Link
      href={href || '/complaint/' + complaint.id}
      className="flex items-center gap-3 rounded-3xl bg-white p-3 shadow-card transition active:scale-[0.99]"
    >
      {complaint.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={complaint.photoUrl}
          alt=""
          loading="lazy"
          className="h-[72px] w-[72px] shrink-0 rounded-2xl object-cover"
        />
      ) : (
        <CategoryIcon id={cat.id} size="lg" className="h-[72px] w-[72px]" />
      )}

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[15px] font-bold leading-snug text-slate-900">
          {complaint.description}
        </p>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
          <Icon name="pin" className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{ward || t('common.none')}</span>
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <Icon name="calendar" className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{shortDate(complaint.createdAt, lang)}</span>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <StatusBadge status={complaint.status} size="sm" />
        <Icon name="chevronRight" className="h-4 w-4 text-slate-300" />
      </div>
    </Link>
  );
}
