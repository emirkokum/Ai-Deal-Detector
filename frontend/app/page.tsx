"use client";

import { useEffect, useState, useMemo } from "react";
import GameCard from "./components/GameCard";
import Header from "./components/Header";
import LoadingSkeleton from "./components/LoadingSkeleton";
import { GameDeal } from "./types";

export default function Home() {
  const [deals, setDeals] = useState<GameDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filteredDeals, setFilteredDeals] = useState<GameDeal[]>([]);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const response = await fetch("http://localhost:3000/prices/best-deals");
        if (!response.ok) {
          throw new Error("Failed to fetch deals");
        }
        const data = await response.json();
        // Sort by AI score by default
        const sortedData = [...data].sort((a, b) => b.score - a.score);
        setDeals(sortedData);
        setFilteredDeals(sortedData);
      } catch (err) {
        setError("Veriler şu an alınamıyor, backend kapalı olabilir.");
      } finally {
        setLoading(false);
      }
    };

    fetchDeals();
  }, []);

  // Separate Golden Deals (score >= 90) from regular deals
  const { goldenDeals, regularDeals } = useMemo(() => {
    const golden = filteredDeals.filter((deal) => deal.score >= 90);
    const regular = filteredDeals.filter((deal) => deal.score < 90);
    return { goldenDeals: golden, regularDeals: regular };
  }, [filteredDeals]);

  const handleSearch = (searchTerm: string) => {
    const lowerTerm = searchTerm.toLowerCase();
    const filtered = deals.filter((deal) =>
      deal.title.toLowerCase().includes(lowerTerm)
    );
    setFilteredDeals(filtered);
  };

  const handleFilter = (filterType: string) => {
     if (filterType === "score") {
       const sorted = [...filteredDeals].sort((a,b) => b.score - a.score);
       setFilteredDeals(sorted);
     } else if(filterType === "discount") {
       const sorted = [...filteredDeals].sort((a,b) => b.discountRate - a.discountRate);
       setFilteredDeals(sorted);
     }
  };


  return (
    <div className="flex min-h-screen flex-col bg-slate-950 font-sans text-slate-100">
      <Header onSearch={handleSearch} onFilter={handleFilter} />
      
      <main className="container mx-auto px-4 py-8">
        {loading ? (
             <LoadingSkeleton />
        ) : error ? (
           <div className="flex flex-col items-center justify-center py-20 text-center">
             <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-4 rounded-lg">
                <p className="text-lg font-semibold mb-2">Hata Oluştu</p>
                <p>{error}</p>
             </div>
           </div>
        ) : (
          <>
            {/* Golden Deals Section */}
            {goldenDeals.length > 0 && (
              <section className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">🏆</span>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                    Altın Fırsatlar
                  </h2>
                  <span className="px-3 py-1 text-xs font-semibold bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30 rounded-full text-yellow-400">
                    AI Puanı 90+
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {goldenDeals.map((deal) => (
                    <div key={deal.id} className="relative">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 rounded-xl opacity-75 blur-sm"></div>
                      <div className="relative">
                        <GameCard deal={deal} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Regular Deals Section */}
            {regularDeals.length > 0 && (
              <section>
                {goldenDeals.length > 0 && (
                  <div className="flex items-center gap-3 mb-6">
                    <span className="text-2xl">🎮</span>
                    <h2 className="text-xl font-semibold text-slate-300">
                      Diğer Fırsatlar
                    </h2>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {regularDeals.map((deal) => (
                    <GameCard key={deal.id} deal={deal} />
                  ))}
                </div>
              </section>
            )}

            {/* No deals message */}
            {filteredDeals.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-lg text-slate-400">
                  Gösterilecek fırsat bulunamadı.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

