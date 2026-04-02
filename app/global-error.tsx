'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="fr">
      <body className="bg-cral-bg text-cral-text font-body antialiased min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">💥</div>
          <h1 className="font-display text-2xl font-bold text-cral-text mb-2">
            Quelque chose s&apos;est cassé
          </h1>
          <p className="text-cral-sub text-sm mb-6">
            Une erreur inattendue s&apos;est produite. Nos ingénieurs Cral sont sur le coup.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="btn-gold px-6 py-2 text-sm"
            >
              Réessayer
            </button>
            <Link href="/dashboard" className="btn-outline px-6 py-2 text-sm">
              Dashboard
            </Link>
          </div>
        </div>
      </body>
    </html>
  )
}
