"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface FavoritesContextType {
  favorites: string[];
  addFavorite: (gameId: string) => void;
  removeFavorite: (gameId: string) => void;
  isFavorite: (gameId: string) => boolean;
  toggleFavorite: (gameId: string) => void;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

const STORAGE_KEY = "ai-deal-detector-favorites";

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load favorites:", error);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever favorites change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
      } catch (error) {
        console.error("Failed to save favorites:", error);
      }
    }
  }, [favorites, isLoaded]);

  const addFavorite = (gameId: string) => {
    setFavorites((prev) => {
      if (prev.includes(gameId)) return prev;
      return [...prev, gameId];
    });
  };

  const removeFavorite = (gameId: string) => {
    setFavorites((prev) => prev.filter((id) => id !== gameId));
  };

  const isFavorite = (gameId: string) => {
    return favorites.includes(gameId);
  };

  const toggleFavorite = (gameId: string) => {
    if (isFavorite(gameId)) {
      removeFavorite(gameId);
    } else {
      addFavorite(gameId);
    }
  };

  return (
    <FavoritesContext.Provider
      value={{ favorites, addFavorite, removeFavorite, isFavorite, toggleFavorite }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return context;
}
