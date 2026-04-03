"use client";

import { Wallet, Gem } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ClassementToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view") || "cash";

  const setView = (view: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("view", view);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex bg-gray-900/50 p-1 rounded-xl border border-gray-800 w-fit">
      <button
        onClick={() => setView("cash")}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
          currentView === "cash" 
            ? "bg-gold-500 text-black shadow-lg" 
            : "text-gray-400 hover:text-white"
        }`}
      >
        <Wallet size={16} /> Argent
      </button>
      <button
        onClick={() => setView("assets")}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
          currentView === "assets" 
            ? "bg-blue-600 text-white shadow-lg" 
            : "text-gray-400 hover:text-white"
        }`}
      >
        <Gem size={16} /> Valeur Totale
      </button>
    </div>
  );
}