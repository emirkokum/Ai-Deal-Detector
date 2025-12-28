"use client";

import { useState, useEffect } from "react";
import { useFavorites } from "../context/FavoritesContext";
import { Bell, Heart, ArrowLeft, Send, CheckCircle, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { GameDeal } from "../types";

export default function NotifyPage() {
  const { favorites } = useFavorites();
  const [chatId, setChatId] = useState("");
  const [favoriteGames, setFavoriteGames] = useState<GameDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  // Load existing subscription on mount
  useEffect(() => {
    const savedChatId = localStorage.getItem("telegram-chat-id");
    if (savedChatId) {
      setChatId(savedChatId);
    }
  }, []);

  // Fetch favorite games details
  useEffect(() => {
    const fetchFavoriteGames = async () => {
      if (favorites.length === 0) {
        setFavoriteGames([]);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("http://localhost:3000/prices/best-deals");
        if (!response.ok) throw new Error("Failed to fetch");
        const allDeals: GameDeal[] = await response.json();
        const favGames = allDeals.filter((deal) => favorites.includes(deal.id));
        setFavoriteGames(favGames);
      } catch (error) {
        console.error("Failed to fetch favorite games:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFavoriteGames();
  }, [favorites]);

  const handleSave = async () => {
    if (!chatId.trim()) {
      setStatus("error");
      setMessage("Lütfen Telegram Chat ID girin.");
      return;
    }

    if (favorites.length === 0) {
      setStatus("error");
      setMessage("Lütfen önce favori oyun ekleyin.");
      return;
    }

    setSaving(true);
    setStatus("idle");

    try {
      const response = await fetch("http://localhost:3000/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: chatId.trim(),
          gameIds: favorites,
        }),
      });

      if (!response.ok) {
        throw new Error("Subscription failed");
      }

      localStorage.setItem("telegram-chat-id", chatId.trim());
      setStatus("success");
      setMessage("Bildirimler başarıyla aktifleştirildi! 🎉");
    } catch (error) {
      setStatus("error");
      setMessage("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 font-sans text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Geri Dön</span>
            </Link>
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6 text-indigo-400" />
              <h1 className="text-xl font-bold text-white">Bildirim Ayarları</h1>
            </div>
            <div className="w-24" /> {/* Spacer for centering */}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex-1">
        {/* Telegram Setup Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-500/10 rounded-xl">
              <Send className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Telegram Bağlantısı</h2>
              <p className="text-slate-400 text-sm">
                Fiyat düşüşlerinde anında bildirim al
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Telegram Chat ID
              </label>
              <input
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="Örn: 123456789"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
              <p className="text-slate-500 text-xs mt-2">
                💡 Chat ID öğrenmek için{" "}
                <a
                  href="https://t.me/userinfobot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:underline"
                >
                  @userinfobot
                </a>
                &apos;a mesaj atın.
              </p>
            </div>

            {status !== "idle" && (
              <div
                className={`flex items-center gap-2 p-3 rounded-lg ${
                  status === "success"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}
              >
                {status === "success" ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                <span className="text-sm">{message}</span>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <Bell className="w-5 h-5" />
                  Bildirimleri Aktifleştir
                </>
              )}
            </button>
          </div>
        </div>

        {/* Favorite Games Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-red-500/10 rounded-xl">
              <Heart className="w-6 h-6 text-red-400 fill-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Favori Oyunlarınız</h2>
              <p className="text-slate-400 text-sm">
                Bu oyunların fiyatı düştüğünde bildirim alacaksınız
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : favoriteGames.length === 0 ? (
            <div className="text-center py-8">
              <Heart className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500">
                Henüz favori oyun eklemediniz.
              </p>
              <Link
                href="/"
                className="text-indigo-400 hover:underline text-sm mt-2 inline-block"
              >
                Oyunlara göz atın →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {favoriteGames.map((game) => (
                <div
                  key={game.id}
                  className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50"
                >
                  <img
                    src={game.image}
                    alt={game.title}
                    className="w-16 h-10 object-cover rounded"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = `https://via.placeholder.com/64x40?text=${encodeURIComponent(
                        game.title.substring(0, 10)
                      )}`;
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white truncate">{game.title}</h3>
                    <p className="text-emerald-400 text-sm font-bold">
                      ${game.currentPrice.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
