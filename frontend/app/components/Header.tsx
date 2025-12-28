import React from "react";
import { Search, Flame, Filter, Bell } from "lucide-react";
import Link from "next/link";

interface HeaderProps {
  onSearch: (term: string) => void;
  onFilter: (type: string) => void;
}

const Header: React.FC<HeaderProps> = ({ onSearch, onFilter }) => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [activeFilter, setActiveFilter] = React.useState("all");

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    onSearch(val);
  };

  const toggleHighScore = () => {
     // If already filtered by score, maybe toggle off? 
     // For simplicity based on previous code 'highScoreOnly', let's just toggle between 'score' and 'all'
     const newFilter = activeFilter === "score" ? "all" : "score";
     setActiveFilter(newFilter);
     onFilter(newFilter);
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800 py-4 px-6 mb-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Logo/Brand */}
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent tracking-tight">
            Steam Deal Detector
          </h1>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Oyun ara..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
            />
          </div>

          <button
            onClick={toggleHighScore}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
              activeFilter === "score"
                ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-500 shadow-lg shadow-yellow-500/10"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            <Filter className="w-4 h-4" />
            Yüksek Skorlar
          </button>

          {/* Notification Settings Button */}
          <Link
            href="/notify"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border bg-slate-900 border-slate-800 text-slate-400 hover:border-indigo-500 hover:text-indigo-400"
          >
            <Bell className="w-4 h-4" />
            Bildirimler
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Header;
