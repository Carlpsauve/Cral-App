import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="font-display text-8xl font-bold text-shimmer mb-4">404</div>
        <h1 className="font-display text-2xl font-bold text-cral-text mb-2">
          Page introuvable
        </h1>
        <p className="text-cral-sub text-sm mb-8">
          Cette page n&apos;existe pas ou a été déplacée.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/dashboard" className="btn-gold px-6 py-2 text-sm">
            Dashboard
          </Link>
          <Link href="/" className="btn-outline px-6 py-2 text-sm">
            Accueil
          </Link>
        </div>
      </div>
    </div>
  )
}
