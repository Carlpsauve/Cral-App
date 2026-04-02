export const dynamic = 'force-dynamic'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(#fbbf24 1px, transparent 1px), linear-gradient(90deg, #fbbf24 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      {/* Radial glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[800px] h-[800px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.05) 0%, transparent 70%)' }}
        />
      </div>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
