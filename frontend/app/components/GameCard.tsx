import React from "react";
import { ExternalLink, BrainCircuit, Star, Heart } from "lucide-react";
import { GameDeal } from "../types";
import { useFavorites } from "../context/FavoritesContext";

interface GameCardProps {
  deal: GameDeal;
}

const GameCard: React.FC<GameCardProps> = ({ deal }) => {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorited = isFavorite(deal.id);
  const isHighScore = deal.score >= 90;
  const isMidScore = deal.score >= 80 && deal.score < 90;

  return (
    <div className="group bg-slate-900 border border-slate-800 rounded-xl overflow-hidden transition-all duration-300 hover:border-slate-700 hover:scale-[1.02] hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col h-full relative">
      {/* Image Area */}
      <div className="relative h-44 overflow-hidden">
        <img
          src={deal.image}
          alt={deal.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (deal.fallbackImage && target.src !== deal.fallbackImage) {
              target.src = deal.fallbackImage;
            } else {
              target.src = `https://via.placeholder.com/460x215?text=${encodeURIComponent(
                deal.title
              )}`;
            }
          }}
        />

        {/* Badges Container */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {/* Favorite Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              toggleFavorite(deal.id);
            }}
            className={`p-2 rounded-lg backdrop-blur-md border transition-all duration-300 ${
              favorited
                ? "bg-red-500/20 border-red-500/50 text-red-500 scale-110 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                : "bg-slate-900/40 border-white/10 text-white/70 hover:text-white hover:bg-slate-900/60"
            }`}
          >
            <Heart className={`w-4 h-4 ${favorited ? "fill-red-500" : ""}`} />
          </button>

          {/* Score Badge */}
          <div
            className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1.5 text-xs backdrop-blur-md transition-shadow duration-300
            ${
              isHighScore
                ? "bg-yellow-500/10 border-yellow-500/50 text-yellow-400 glow-gold"
                : isMidScore
                ? "bg-blue-500/10 border-blue-500/50 text-blue-400 glow-blue"
                : "bg-slate-500/10 border-slate-500/50 text-slate-400"
            }
          `}
          >
            <Star
              className={`w-3.5 h-3.5 ${
                isHighScore
                  ? "fill-yellow-400"
                  : isMidScore
                  ? "fill-blue-400"
                  : ""
              }`}
            />
            {deal.score}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-lg font-bold text-white line-clamp-1 mb-2 group-hover:text-indigo-400 transition-colors">
          {deal.title}
        </h3>

        {/* Pricing Area */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex flex-col">
            <span className="text-slate-500 text-xs line-through font-medium">
              ${deal.oldPrice.toFixed(2)}
            </span>
            <span className="text-emerald-400 text-xl font-extrabold leading-tight">
              ${deal.currentPrice.toFixed(2)}
            </span>
          </div>
          <div className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-sm rotate-2 shadow-lg">
            -{deal.discountRate}%
          </div>
        </div>

        {/* AI Analysis */}
        <div className="bg-slate-950/50 border border-slate-800/50 rounded-lg p-3 mb-4 flex-grow transition-all duration-300 group-hover:border-indigo-500/30 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.1)]">
          <div className="flex items-center gap-2 text-indigo-400 text-[9px] uppercase tracking-[0.15em] font-black mb-1.5">
            <BrainCircuit className="w-3 h-3" />
            AI'ın Analizi
          </div>
          <p className="text-slate-400 text-xs italic leading-relaxed">
            "{deal.analysis}"
          </p>
        </div>

        <a
          href={deal.link}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/10"
        >
          <span className="text-sm">Steam'de Görüntüle</span>
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
};

export default GameCard;
