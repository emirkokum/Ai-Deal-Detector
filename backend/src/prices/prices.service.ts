import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from './ai.service';

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
@Injectable()
export class PricesService {
  private readonly logger = new Logger(PricesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
  ) {}

  async savePrice(data: {
    gameId: string;
    amount: number;
    currency: string;
    source: string;
  }) {
    return this.prisma.price.create({ data });
  }

  async checkDealEligibility(gameId: string, currentPrice: number) {
    // 1. ADIM: Son 24 saat analizi kontrolü
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const existingDeal = await this.prisma.deal.findFirst({
      where: {
        gameId: gameId,
        updatedAt: { gte: oneDayAgo },
      },
    });

    if (existingDeal && existingDeal.dealScore !== 50 && existingDeal.dealScore !== 75) {
      this.logger.debug(`Oyun (ID: ${gameId}) son 24 saat içinde analiz edilmiş, atlanıyor...`);
      return null;
    }

    // 2. ADIM: Fiyat geçmişini getir
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const priceHistory = await this.prisma.price.findMany({
      where: { gameId, createdAt: { gte: ninetyDaysAgo } },
      orderBy: { amount: 'asc' },
    });

    if (priceHistory.length < 2) return null;

    const avgPrice =
      priceHistory.reduce((acc, p) => acc + p.amount, 0) / priceHistory.length;
    const historicalLow = priceHistory[0].amount;

    // 3. ADIM: İndirim Oranı Hesaplama & %70 Eşiği Kontrolü
    const discountRate = ((avgPrice - currentPrice) / avgPrice) * 100;

    if (discountRate >= 70) {
      const game = await this.prisma.game.findUnique({ where: { id: gameId } });
      if (!game) return null;
      
      this.logger.debug(`${game.name} için %${discountRate.toFixed(0)} indirim saptandı. Aday listesine eklendi.`);
      
      return {
        gameId: game.id,
        gameName: game.name,
        currentPrice,
        avgPrice,
        historicalLow,
      };
    }

    return null;
  }

  async analyzeBatch(
    items: {
      gameId: string;
      gameName: string;
      currentPrice: number;
      avgPrice: number;
      historicalLow: number;
    }[],
  ) {
    if (items.length === 0) return;

    try {
      const results = await this.aiService.analyzeDealsBatch(items);

      for (const result of results) {
        const item = items.find((i) => i.gameId === result.gameId);
        if (!item) continue;

        await this.prisma.deal.upsert({
          where: { gameId: item.gameId },
          create: {
            gameId: item.gameId,
            oldPrice: item.avgPrice,
            newPrice: item.currentPrice,
            dealScore: result.score,
            aiAnalysis: result.reasoning,
          },
          update: {
            oldPrice: item.avgPrice,
            newPrice: item.currentPrice,
            dealScore: result.score,
            aiAnalysis: result.reasoning,
            updatedAt: new Date(),
          },
        });
        
        this.logger.log(`Deal Analizi Tamamlandı: ${item.gameName} (Skor: ${result.score})`);
      }
    } catch (error) {
      this.logger.error('Toplu analiz hatası, varsayılan değerler atanıyor:', error.message);
      
      for (const item of items) {
        await this.prisma.deal.upsert({
          where: { gameId: item.gameId },
          create: {
            gameId: item.gameId,
            oldPrice: item.avgPrice,
            newPrice: item.currentPrice,
            dealScore: 75,
            aiAnalysis: "AI analizi geçici olarak yapılamadı (Limits)",
          },
          update: {
            oldPrice: item.avgPrice,
            newPrice: item.currentPrice,
            dealScore: 75,
            aiAnalysis: "AI analizi geçici olarak yapılamadı (Limits)",
            updatedAt: new Date(),
          },
        });
      }
    }
  }

  // Eski yöntemleri kaldırdım (appendPrice içinde detectDeal çağrısı yok edildi, detectDeal tamamen silindi)
  async appendPrice(data: {
    gameId: string;
    amount: number;
    currency: string;
    source: string;
  }) {
    // Fiyatı kaydet
    const newPrice = await this.prisma.price.create({ data });
    return newPrice;
  }

  async getBestDeals() {
    const deals = await this.prisma.deal.findMany({
      where: {
        dealScore: { gte: 70 }, // Sadece 70 puan ve üstü "fırsatları" getir
      },
      include: {
        game: true, // Game tablosundaki name ve externalId'ye ulaşmak için şart
      },
      orderBy: {
        dealScore: 'desc', // En iyi fırsat en üstte
      },
    });

    // Ham veriyi Frontend dostu bir yapıya dönüştürüyoruz
    return deals.map((deal) => {
      // Steam Resim URL'ini oluşturma mantığı BURADA:
      const steamImageUrl = deal.game.externalId
        ? `https://cdn.akamai.steamstatic.com/steam/apps/${deal.game.externalId}/header.jpg`
        : `https://via.placeholder.com/460x215?text=${encodeURIComponent(deal.game.name)}`; // Eğer ID yoksa yedek resim

      return {
        id: deal.id,
        title: deal.game.name,
        score: deal.dealScore,
        currentPrice: deal.newPrice,
        oldPrice: deal.oldPrice,
        // İndirim oranını yüzde olarak hesapla
        discountRate: Math.round(
          ((deal.oldPrice - deal.newPrice) / deal.oldPrice) * 100,
        ),
        image: steamImageUrl,
        analysis: deal.aiAnalysis,
        link: deal.game.externalId
          ? `https://store.steampowered.com/app/${deal.game.externalId}`
          : `https://store.steampowered.com/search/?term=${encodeURIComponent(deal.game.name)}`,
        externalId: deal.game.externalId,
        fallbackImage: deal.game.imageUrl,
        updatedAt: deal.updatedAt,
      };
    });
  }
}
