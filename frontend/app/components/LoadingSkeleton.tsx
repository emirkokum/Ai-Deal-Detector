import React from "react";

const LoadingSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="bg-slate-900/50 rounded-xl overflow-hidden border border-slate-800 animate-pulse"
        >
          <div className="h-48 bg-slate-800"></div>
          <div className="p-4 space-y-4">
            <div className="h-6 bg-slate-800 rounded w-3/4"></div>
            <div className="h-4 bg-slate-800 rounded w-1/2"></div>
            <div className="h-20 bg-slate-800/50 rounded"></div>
            <div className="h-10 bg-slate-800 rounded"></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default LoadingSkeleton;

