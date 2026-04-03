"use client"
import { useState } from "react"
import { formatCral } from "@/lib/utils"

interface BoosterCardProps {
  setId: string
  name: string
  price: number
  image: string
  onPackOpened: (cards: any[]) => void
}

export function BoosterCard({ setId, name, price, image, onPackOpened }: BoosterCardProps) {
  const [loading, setLoading] = useState(false)

  const buyPack = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/shop/booster", {
        method: "POST",
        body: JSON.stringify({ setId }),
      })
      const data = await res.json()
      if (data.success) {
        onPackOpened(data.pulledCards)
      } else {
        alert(data.error || "Erreur lors de l'achat")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-4 flex flex-col items-center gap-4 hover:border-gold-500/50 transition-colors">
      <img src={image} alt={name} className="w-40 h-auto rounded shadow-lg" />
      <div className="text-center">
        <h3 className="font-bold text-lg">{name}</h3>
        <p className="text-gold-400 font-mono">{formatCral(price)} ₡</p>
      </div>
      <button 
        onClick={buyPack}
        disabled={loading}
        className="btn-primary w-full"
      >
        {loading ? "Ouverture..." : "Acheter"}
      </button>
    </div>
  )
}