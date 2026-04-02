export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-56 rounded-lg bg-cral-card" />
        <div className="h-4 w-40 rounded-lg bg-cral-surface" />
      </div>

      {/* Card skeletons */}
      <div className="h-32 rounded-2xl bg-cral-card" />

      <div className="grid grid-cols-2 gap-4">
        <div className="h-20 rounded-xl bg-cral-card" />
        <div className="h-20 rounded-xl bg-cral-card" />
      </div>

      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-xl bg-cral-card" />
        ))}
      </div>
    </div>
  )
}
