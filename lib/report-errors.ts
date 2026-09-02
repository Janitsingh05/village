/**
 * Turns a failed submission into something a villager can act on.
 *
 * Everything used to collapse into one generic "could not file". That is fine
 * for a fluke and useless for the two failures that actually happen: a Firebase
 * project with anonymous sign-in switched off, which no amount of retrying
 * fixes, and a phone with no signal on its very first visit, which fixes itself.
 * Telling someone to try again for the first one wastes their afternoon, and
 * neither is diagnosable from a screenshot when both say the same thing.
 */
export type ReportFailure =
  /** The Firebase project has Anonymous sign-in disabled. A deployment mistake. */
  | 'identity-disabled'
  /** First-ever visit with no network. The draft is saved; retry when there is signal. */
  | 'identity-offline'
  /** The rules refused the write — usually rules older than this build. */
  | 'denied'
  | 'failed';

export function readReportError(err: unknown): ReportFailure {
  const message = err instanceof Error ? err.message : '';

  if (message.startsWith('NO_IDENTITY:')) {
    const reason = message.slice('NO_IDENTITY:'.length);
    if (reason === 'disabled') return 'identity-disabled';
    if (reason === 'offline') return 'identity-offline';
    return 'failed';
  }

  if ((err as { code?: string })?.code === 'permission-denied') return 'denied';
  return 'failed';
}

/** The locale key for each, so every caller reports them the same way. */
export const REPORT_ERROR_KEY: Record<ReportFailure, string> = {
  'identity-disabled': 'report.errIdentityDisabled',
  'identity-offline': 'report.errIdentityOffline',
  denied: 'report.errDenied',
  failed: 'report.failed',
};
