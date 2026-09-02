'use client';

/**
 * The boundary for errors thrown by the root layout itself.
 *
 * This one replaces the whole document, so it has to ship its own <html> and
 * <body> — and it cannot rely on the stylesheet, because a layout that failed
 * to render may never have loaded it. Hence inline styles: ugly, and the only
 * thing guaranteed to work at this point.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="hi">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
          background: '#f8fafc',
          color: '#0f172a',
          fontFamily: 'system-ui, "Noto Sans Devanagari", "Nirmala UI", sans-serif',
        }}
      >
        <div style={{ maxWidth: 360, textAlign: 'center' }}>
          <p style={{ fontSize: 40, margin: 0 }}>⚠️</p>
          <h1 style={{ fontSize: 20, margin: '12px 0 0' }}>ऐप नहीं खुल पाया</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: '#475569', margin: '8px 0 0' }}>
            दोबारा कोशिश कीजिए। आपकी कोई शिकायत नहीं मिटी है.
            <br />
            The app could not start. Nothing you filed has been lost.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 20,
              width: '100%',
              padding: '14px 20px',
              borderRadius: 16,
              border: 0,
              background: '#17864c',
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            दोबारा कोशिश करें · Try again
          </button>
          {error.digest && (
            <p style={{ marginTop: 16, fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
              {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
