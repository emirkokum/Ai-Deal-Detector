"use client";

import { useEffect, useState } from "react";
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
        setDeals(data);
        setFilteredDeals(data);
      } catch (err) {
        setError("Veriler şu an alınamıyor, backend kapalı olabilir.");
      } finally {
        setLoading(false);
      }
    };

    fetchDeals();
  }, []);

  const handleSearch = (searchTerm: string) => {
    const lowerTerm = searchTerm.toLowerCase();
    const filtered = deals.filter((deal) =>
      deal.title.toLowerCase().includes(lowerTerm)
    );
    setFilteredDeals(filtered);
  };

  const handleFilter = (filterType: string) => {
      // Implement additional sorting/filtering logic if needed provided by Header
      // For now, if "score" is passed maybe sort by score
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredDeals.map((deal) => (
              <GameCard key={deal.id} deal={deal} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
