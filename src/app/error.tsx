"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Crash React détecté :", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-elsass-black p-6 text-white text-center">
      <div className="max-w-2xl bg-elsass-ink border border-elsass-red/40 p-8 rounded-xl shadow-2xl">
        <h2 className="text-2xl font-bold text-elsass-red mb-4">Une erreur critique est survenue</h2>
        <div className="bg-black/50 p-4 rounded text-left overflow-auto text-elsass-gold font-mono text-sm mb-6">
          {error.message || "Erreur inconnue"}
        </div>
        <button
          onClick={() => reset()}
          className="bg-elsass-red hover:bg-elsass-red/90 text-white px-6 py-2 rounded-md font-medium transition-colors"
        >
          Tenter de recharger la page
        </button>
      </div>
    </div>
  );
}