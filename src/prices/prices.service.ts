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

  async appendPrice(data: {
    gameId: string;
    amount: number;
    currency: string;
    source: string;
  }) {
    // Fiyatı kaydet
    const newPrice = await this.prisma.price.create({ data });

    // Fırsat analizi yap
    await this.detectDeal(data.gameId, data.amount);

    return newPrice;
  }

  private async detectDeal(gameId: string, currentPrice: number) {
    // 1. ADIM: Son 24 saat içinde bu oyun zaten analiz edilmiş mi kontrol et
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const existingDeal = await this.prisma.deal.findFirst({
      where: {
        gameId: gameId,
        updatedAt: { gte: oneDayAgo },
      },
    });

    if (existingDeal && existingDeal.dealScore !== 50) {
      this.logger.debug(
        `Oyun (ID: ${gameId}) son 24 saat içinde zaten analiz edilmiş, atlanıyor...`,
      );
      return;
    }

    // 2. ADIM: Fiyat geçmişini getir
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const priceHistory = await this.prisma.price.findMany({
      where: { gameId, createdAt: { gte: ninetyDaysAgo } },
      orderBy: { amount: 'asc' },
    });

    if (priceHistory.length < 2) return;

    const avgPrice =
      priceHistory.reduce((acc, p) => acc + p.amount, 0) / priceHistory.length;
    const historicalLow = priceHistory[0].amount;

    // 3. ADIM: İndirim Oranı Hesaplama & %70 Eşiği Kontrolü
    const discountRate = ((avgPrice - currentPrice) / avgPrice) * 100;

    if (discountRate >= 70) {
      const game = await this.prisma.game.findUnique({ where: { id: gameId } });
      if (!game) return;

      this.logger.debug(
        `${game.name} için %${discountRate.toFixed(0)} indirim saptandı. AI analizi başlatılıyor...`,
      );

      // Kota aşımını önlemek için küçük bir bekleme
      await delay(3000);

      try {
        const aiAnalysis = await this.aiService.analyzeDeal(
          game.name,
          currentPrice,
          avgPrice,
          historicalLow,
        );

        const scoreMatch = aiAnalysis.match(/\[SCORE:\s*(\d+)\]/);
        const score = scoreMatch ? parseInt(scoreMatch[1]) : 50;
        const reasoning = aiAnalysis.replace(/\[SCORE:\s*\d+\]/, '').trim();

        // Veritabanına kaydet veya güncelle
        await this.prisma.deal.upsert({
          where: { gameId: game.id },
          create: {
            gameId: game.id,
            oldPrice: avgPrice,
            newPrice: currentPrice,
            dealScore: score,
            aiAnalysis: reasoning,
          },
          update: {
            oldPrice: avgPrice,
            newPrice: currentPrice,
            dealScore: score,
            aiAnalysis: reasoning,
            updatedAt: new Date(),
          },
        });

        this.logger.log(
          `Deal Analizi Tamamlandı: ${game.name} (Skor: ${score})`,
        );
      } catch (error) {
        this.logger.error(
          `${game.name} analizi sırasında hata oluştu:`,
          error.message,
        );
      }
    } else {
      this.logger.debug(
        `Oyun (ID: ${gameId}) indirimi %${discountRate.toFixed(0)}, AI analizine gerek duyulmadı.`,
      );
    }
  }
}
