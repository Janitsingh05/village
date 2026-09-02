'use client';

import { useEffect } from 'react';

/**
 * The last thing between a bad render and a white screen.
 *
 * Deliberately plain: no translation lookup, no context, no Firestore. This
 * boundary catches errors from the providers themselves, so anything it needs
 * might be the very thing that just threw. Both languages are written out
 * because there is no way to know which one was in use.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Nothing is collecting these yet, but a digest in the browser console is
    // the only clue anyone gets when a villager says "it went white".
    console.error('GaonConnect render error:', error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 px-6">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)]">
        <p className="text-4xl" aria-hidden>
          ⚠️
        </p>
        <h1 className="mt-3 text-lg font-bold text-slate-900">कुछ गड़बड़ हो गई</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          ऐप की यह स्क्रीन खुल नहीं पाई। दोबारा कोशिश कीजिए — आपकी कोई शिकायत नहीं मिटी है।
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Something went wrong on this screen. Nothing you filed has been lost.
        </p>

        <button
          onClick={reset}
          className="mt-5 w-full rounded-2xl bg-brand-600 px-5 py-3.5 text-base font-bold text-white transition active:scale-[0.99]"
        >
          दोबारा कोशिश करें · Try again
        </button>
        <a
          href="/"
          className="mt-2 block w-full rounded-2xl border-2 border-slate-200 px-5 py-3 text-base font-semibold text-slate-700"
        >
          होम पर जाएँ · Go home
        </a>

        {error.digest && (
          <p className="mt-4 font-mono text-[11px] text-slate-500">{error.digest}</p>
        )}
      </div>
    </main>
  );
}
