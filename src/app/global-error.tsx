"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body>
        <div style={{ padding: '2rem', backgroundColor: '#020617', color: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>Erreur Globale</h2>
          <pre style={{ background: 'black', padding: '1rem', borderRadius: '8px', color: '#fca5a5', maxWidth: '80vw', overflow: 'auto' }}>
            {error.message}
          </pre>
          <button onClick={() => reset()} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Recharger
          </button>
        </div>
      </body>
    </html>
  );
}