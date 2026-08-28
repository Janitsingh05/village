'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { VILLAGE } from './config';
import { activeVillageId, adoptVillageFromUrl } from './tenant';
import { getVillage } from './villages';
import type { Lang } from './i18n';
import type { Village } from './types';

/**
 * The village this session is looking at. Falls back to the NEXT_PUBLIC_*
 * values so a single-village pilot works with no Firestore village document
 * at all, and upgrades to the real record as soon as one exists.
 */
interface VillageValue {
  id: string;
  village: Village | null;
  name: (lang: Lang) => string;
  district: (lang: Lang) => string;
  reload: () => void;
}

const VillageContext = createContext<VillageValue | null>(null);

export function VillageProvider({ children }: { children: React.ReactNode }) {
  const [id, setId] = useState(VILLAGE.id);
  const [village, setVillage] = useState<Village | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    // A ?v=<id> link picks the village before anything is fetched.
    adoptVillageFromUrl();
    setId(activeVillageId());
  }, []);

  useEffect(() => {
    let alive = true;
    getVillage(id)
      .then((v) => alive && setVillage(v))
      .catch(() => alive && setVillage(null));
    return () => {
      alive = false;
    };
  }, [id, nonce]);

  // Stable across renders: consumers put this in effect dependency lists, and
  // an identity that changed with every load would loop them.
  const reload = useCallback(() => {
    setId(activeVillageId());
    setNonce((n) => n + 1);
  }, []);

  const value = useMemo<VillageValue>(
    () => ({
      id,
      village,
      name: (lang) => village?.name || (lang === 'en' ? VILLAGE.nameEn : VILLAGE.nameHi),
      district: (lang) => {
        if (village) return [village.district, village.state].filter(Boolean).join(', ');
        return (lang === 'en' ? VILLAGE.districtEn : VILLAGE.districtHi) || VILLAGE.districtHi;
      },
      reload,
    }),
    [id, village, reload]
  );

  return <VillageContext.Provider value={value}>{children}</VillageContext.Provider>;
}

export function useVillage(): VillageValue {
  const ctx = useContext(VillageContext);
  if (!ctx) throw new Error('useVillage must be used inside <VillageProvider>');
  return ctx;
}
