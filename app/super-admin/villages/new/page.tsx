'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Icon from '@/components/Icon';
import { createVillage } from '@/lib/villages';
import { STATES, districtsFor } from '@/lib/india';
import { useI18n } from '@/lib/i18n';

export default function NewVillagePage() {
  const router = useRouter();
  const { t } = useI18n();

  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [address, setAddress] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const knownDistricts = districtsFor(state);
  const canSubmit =
    name.trim().length >= 2 &&
    state !== '' &&
    district.trim() !== '' &&
    adminName.trim().length >= 2 &&
    adminPhone.replace(/\D/g, '').length === 10 &&
    !busy;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await createVillage({ name, nameEn, state, district, address, adminName, adminPhone });
      router.push('/super-admin/villages');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('announce.failed'));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-4">
      <button
        onClick={() => router.push('/super-admin/villages')}
        className="mb-3 flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800"
      >
        <Icon name="back" className="h-4 w-4" />
        {t('super.villagesTitle')}
      </button>

      <h1 className="mb-4 text-xl font-bold text-slate-900">{t('super.addVillage')}</h1>

      <form onSubmit={onSubmit} className="space-y-4 rounded-3xl bg-white p-4 shadow-card">
        <div>
          <label className="label" htmlFor="name">
            {t('super.fieldName')} <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('super.fieldNamePlaceholder')}
            className="field"
          />
        </div>

        <div>
          <label className="label" htmlFor="nameEn">
            {t('super.fieldNameEn')}
          </label>
          <input
            id="nameEn"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder={t('super.fieldNameEnPlaceholder')}
            className="field"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="state">
              {t('super.fieldState')} <span className="text-red-500">*</span>
            </label>
            <select
              id="state"
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setDistrict('');
              }}
              className="field appearance-none"
            >
              <option value="">{t('super.fieldStatePlaceholder')}</option>
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="district">
              {t('super.fieldDistrict')} <span className="text-red-500">*</span>
            </label>
            {knownDistricts.length > 0 ? (
              <select
                id="district"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="field appearance-none"
              >
                <option value="">{t('super.fieldDistrictPlaceholder')}</option>
                {knownDistricts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            ) : (
              // No district list for this state yet — free text beats a dead end.
              <input
                id="district"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder={t('super.fieldDistrictPlaceholder')}
                className="field"
                disabled={!state}
              />
            )}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="address">
            {t('super.fieldAddress')}
          </label>
          <textarea
            id="address"
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t('super.fieldAddressPlaceholder')}
            className="field resize-none"
          />
        </div>

        <div>
          <label className="label" htmlFor="adminPhone">
            {t('super.fieldAdminPhone')} <span className="text-red-500">*</span>
          </label>
          <input
            id="adminPhone"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={adminPhone}
            onChange={(e) => setAdminPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="98XXXXXXXX"
            className="field"
          />
        </div>

        <div>
          <label className="label" htmlFor="adminName">
            {t('super.fieldAdminName')} <span className="text-red-500">*</span>
          </label>
          <input
            id="adminName"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            placeholder={t('super.fieldNamePlaceholder')}
            className="field"
          />
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
        )}

        <button type="submit" disabled={!canSubmit} className="btn-primary">
          {busy ? t('report.submitting') : t('super.submit')}
        </button>
      </form>
    </main>
  );
}
