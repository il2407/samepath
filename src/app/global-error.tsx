"use client";

/**
 * Last-resort boundary for errors in the root layout itself. It replaces the
 * whole document, so global styles and fonts aren't available — inline
 * styles only, kept to the design-system colors.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="he" dir="rtl">
      <body style={{ margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8faf7", color: "#17211d", fontFamily: "system-ui, sans-serif" }}>
        <title>SamePath — שגיאה</title>
        <main style={{ maxWidth: 420, padding: 16, textAlign: "center" }}>
          <h1 style={{ fontSize: 24 }}>משהו השתבש</h1>
          <p style={{ color: "#52615a" }}>אירעה שגיאה בלתי צפויה. אפשר לנסות שוב, ואם הבעיה חוזרת — לחזור מאוחר יותר.</p>
          <button
            onClick={() => retry()}
            style={{ background: "#235c47", color: "#fff", border: 0, borderRadius: 4, padding: "12px 24px", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
          >
            לנסות שוב
          </button>
          {error.digest ? (
            <p style={{ fontSize: 12, color: "#52615a" }}>
              קוד לפנייה לתמיכה: <span dir="ltr" style={{ fontFamily: "monospace" }}>{error.digest}</span>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
