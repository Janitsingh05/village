'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { watchSession, type AdminSession } from '@/lib/auth';
import { projectId } from '@/lib/firebase';
import { getVillage } from '@/lib/villages';
import { activeVillageId } from '@/lib/tenant';
import { useI18n } from '@/lib/i18n';

interface Check {
  key: string;
  pass: boolean;
  fixKey: string;
}

/**
 * Runtime configuration doctor. Every check actually probes rather than
 * assuming — a half-configured deployment otherwise fails silently, which is
 * the worst possible way to discover it mid-pilot.
 */
export default function SetupPage() {
  const { t } = useI18n();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [villageId, setVillageId] = useState('');

  useEffect(() => watchSession(setSession), []);

  const run = useCallback(async () => {
    setChecks(null);
    const id = activeVillageId();
    setVillageId(id);

    let village = null;
    let reachable = true;
    try {
      village = await getVillage(id);
    } catch {
      reachable = false;
    }

    setChecks([
      { key: 'setup.firestore', pass: reachable, fixKey: 'setup.firestoreFix' },
      { key: 'setup.villageDoc', pass: Boolean(village), fixKey: 'setup.villageDocFix' },
      {
        key: 'setup.adminLink',
        pass: Boolean(village && session && village.adminUserIds.includes(session.uid)),
        fixKey: 'setup.adminLinkFix',
      },
      {
        key: 'setup.storage',
        pass: Boolean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
        fixKey: 'setup.storageFix',
      },
    ]);
  }, [session]);

  useEffect(() => {
    run();
  }, [run]);

  const allPass = checks?.every((c) => c.pass);

  return (
    <main className="mx-auto max-w-2xl px-4 py-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">{t('setup.title')}</h1>
          <p className="text-sm text-slate-500">{t('setup.subtitle')}</p>
        </div>
        <button
          onClick={run}
          className="shrink-0 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
        >
          {t('setup.recheck')}
        </button>
      </div>

      <p className="mb-4 space-x-3 text-xs text-slate-400">
        <span>
          {t('setup.projectLabel')}: <span className="font-mono">{projectId}</span>
        </span>
        <span>
          {t('setup.villageIdLabel')}: <span className="font-mono">{villageId}</span>
        </span>
      </p>

      {checks === null ? (
        <p className="text-sm text-slate-500">{t('setup.checking')}</p>
      ) : (
        <ul className="space-y-2">
          {checks.map((c) => (
            <li key={c.key} className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-card">
              <span
                className={
                  'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-white ' +
                  (c.pass ? 'bg-brand-600' : 'bg-red-500')
                }
              >
                <Icon
                  name={c.pass ? 'checkCircle' : 'plus'}
                  className={'h-4 w-4 ' + (c.pass ? '' : 'rotate-45')}
                  strokeWidth={2.6}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900">{t(c.key)}</span>
                {!c.pass && (
                  <span className="mt-1 block break-words font-mono text-xs leading-relaxed text-slate-500">
                    {t(c.fixKey)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {allPass && (
        <p className="mt-4 rounded-2xl bg-brand-50 px-4 py-3 text-center text-sm font-semibold text-brand-800">
          {t('setup.allGood')}
        </p>
      )}
    </main>
  );
}
