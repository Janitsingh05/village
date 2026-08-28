import Icon from './Icon';

const TONES = {
  amber: 'bg-amber-50 text-amber-500',
  green: 'bg-brand-50 text-brand-600',
  blue: 'bg-blue-50 text-blue-500',
  violet: 'bg-violet-50 text-violet-500',
} as const;

/**
 * One tile in the home stat row. Sized so four fit across a 360px phone
 * without scrolling — hence the tight type scale.
 */
export default function StatsCard({
  icon,
  tone,
  value,
  label,
  sub,
}: {
  icon: 'doc' | 'checkCircle' | 'clock' | 'users';
  tone: keyof typeof TONES;
  value: string;
  label: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-white px-1.5 py-3 text-center shadow-card">
      <span className={'grid h-9 w-9 place-items-center rounded-full ' + TONES[tone]}>
        <Icon name={icon} className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <p className="mt-2 text-lg font-bold leading-none text-slate-900">{value}</p>
      <p className="mt-1.5 text-[10px] font-semibold leading-tight text-slate-600">{label}</p>
      {sub && <p className="text-[9px] leading-tight text-slate-400">{sub}</p>}
    </div>
  );
}
