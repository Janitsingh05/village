'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Welcome from './Welcome';
import { hasChosenVillage } from '@/lib/tenant';
import { isUnderAny } from '@/lib/route-match';

/**
 * Staff sign in to a village they already belong to; the question this gate
 * asks is a citizen's. An admin opening /admin/login has no business being
 * asked which village they live in first.
 */
const SKIP_PREFIXES = ['/admin', '/super-admin'];

/**
 * Shows the welcome flow once, on a device that has never picked a village.
 *
 * It sits above VillageProvider rather than inside it because the provider
 * resolves its village on mount and would otherwise latch onto the environment
 * default before anyone had been asked. By the time children render, the
 * device has an answer stored and every Firestore path below is already
 * pointed at the right place.
 *
 * `undefined` means the check has not run yet — the first render happens on the
 * server, where localStorage does not exist, so committing to either answer
 * there would guarantee a wrong first paint for half of visitors.
 */
export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [needsWelcome, setNeedsWelcome] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    setNeedsWelcome(!hasChosenVillage());
  }, []);

  if (isUnderAny(pathname, SKIP_PREFIXES)) return <>{children}</>;

  // One frame of nothing rather than a flash of the default village's home
  // screen followed by the welcome flow replacing it.
  if (needsWelcome === undefined) return null;

  if (needsWelcome) return <Welcome onDone={() => setNeedsWelcome(false)} />;

  return <>{children}</>;
}
