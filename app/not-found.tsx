import Link from 'next/link';

/**
 * A mistyped or dead link, answered in the reader's language with a way out.
 *
 * Bilingual and untranslated, like the welcome screen: this page can be reached
 * before the app has loaded anything about who is reading it, so it says both
 * rather than guessing.
 */
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 px-6">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-card">
        <p className="font-mono text-3xl font-bold text-slate-300">404</p>
        <h1 className="mt-3 text-lg font-bold text-slate-900">यह पेज नहीं मिला</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          हो सकता है लिंक पुराना हो या पता ग़लत लिखा गया हो।
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          That page does not exist. The link may be old or mistyped.
        </p>

        <Link
          href="/"
          className="mt-5 block w-full rounded-2xl bg-brand-600 px-5 py-3.5 text-base font-bold text-white transition active:scale-[0.99]"
        >
          होम पर जाएँ · Go home
        </Link>
        <Link
          href="/report"
          className="mt-2 block w-full rounded-2xl border-2 border-slate-200 px-5 py-3 text-base font-semibold text-slate-700"
        >
          समस्या दर्ज करें · Report a problem
        </Link>
      </div>
    </main>
  );
}
