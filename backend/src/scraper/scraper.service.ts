import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import { PricesService } from '../prices/prices.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly pricesService: PricesService,
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly telegramService: TelegramService,
  ) {}

  // Her gün saat 10:00'da çalış (Türkiye saati için UTC+3 = 07:00 UTC)
  @Cron('0 7 * * *')
  async handleCron() {
    this.logger.log('📅 Günlük Steam Fırsat Taraması Başladı...');

    try {
      const response = await firstValueFrom(
        this.httpService.get(
          'https://www.cheapshark.com/api/1.0/deals?storeID=1&pageSize=50',
        ),
      );

      const analysisCandidates: {
        gameId: string;
        gameName: string;
        currentPrice: number;
        avgPrice: number;
        historicalLow: number;
      }[] = [];

      let newPricesCount = 0;
      let skippedCount = 0;

      for (const deal of response.data as any[]) {
        const title = String(deal.title);
        let game = await this.prisma.game.findFirst({ where: { name: title } });
        const steamAppID = deal.steamAppID;
        const thumb = deal.thumb;
        const currentPrice = parseFloat(deal.salePrice);

        // 1. Oyunu Oluştur veya Güncelle
        if (!game) {
          game = await this.prisma.game.create({
            data: {
              name: title,
              platform: 'PC',
              externalId: steamAppID || null,
              imageUrl: thumb || null,
            },
          });
        } else {
          const updateData: any = {};
          if (steamAppID && game.externalId !== steamAppID) updateData.externalId = steamAppID;
          if (thumb && game.imageUrl !== thumb) updateData.imageUrl = thumb;

          if (Object.keys(updateData).length > 0) {
            game = await this.prisma.game.update({
              where: { id: game.id },
              data: updateData,
            });
          }
        }

        // 2. Geçmiş Veri Kontrolü (Sadece bir kez çekilir)
        const hasHistory = await this.prisma.price.findFirst({
          where: {
            gameId: game.id,
            source: { in: ['Steam_Baseline', 'Steam_Historical_Low'] },
          },
        });

        if (!hasHistory) {
          try {
            const gameDetail = await firstValueFrom(
              this.httpService.get(
                `https://www.cheapshark.com/api/1.0/games?id=${deal.gameID}`,
              ),
            );
            const cheapest = gameDetail.data.cheapestPriceEver as {
              price: string;
              date: number;
            };
            const normalPrice = parseFloat(deal.normalPrice);

            await this.prisma.price.create({
              data: {
                gameId: game.id,
                amount: normalPrice,
                currency: 'USD',
                source: 'Steam_Baseline',
                createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
              },
            });

            if (cheapest?.price) {
              await this.prisma.price.create({
                data: {
                  gameId: game.id,
                  amount: parseFloat(cheapest.price),
                  currency: 'USD',
                  source: 'Steam_Historical_Low',
                  createdAt: new Date(cheapest.date * 1000),
                },
              });
            }
            this.logger.debug(`Yeni oyun geçmişi yüklendi: ${title}`);
          } catch (e) {
            this.logger.warn(`Geçmiş veri hatası: ${title}`);
          }
        }

        // 3. AKILLI FİYAT KAYDI - Sadece fiyat değiştiyse kaydet
        const lastPrice = await this.prisma.price.findFirst({
          where: { gameId: game.id, source: 'Steam' },
          orderBy: { createdAt: 'desc' },
        });

        const priceChanged = !lastPrice || lastPrice.amount !== currentPrice;
        const priceDropped = lastPrice && currentPrice < lastPrice.amount;

        if (priceChanged) {
          await this.pricesService.savePrice({
            gameId: game.id,
            amount: currentPrice,
            currency: 'USD',
            source: 'Steam',
          });
          newPricesCount++;

          // 4. AI ANALİZİ - Sadece fiyat DÜŞTÜĞÜNDE analiz yap
          if (priceDropped) {
            const eligibility = await this.pricesService.checkDealEligibility(
              game.id,
              currentPrice,
            );

            if (eligibility) {
              analysisCandidates.push(eligibility);
            }

            // 5. KULLANICI BİLDİRİMLERİ - Bu oyunu favorilemiş kullanıcılara bildirim gönder
            const subscribers = await this.subscriptionsService.findByGameId(game.id);
            
            if (subscribers.length > 0) {
              const discountRate = lastPrice 
                ? Math.round(((lastPrice.amount - currentPrice) / lastPrice.amount) * 100)
                : 0;
              
              const steamImageUrl = game.externalId
                ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.externalId}/header.jpg`
                : undefined;
              
              const steamLink = game.externalId
                ? `https://store.steampowered.com/app/${game.externalId}`
                : `https://store.steampowered.com/search/?term=${encodeURIComponent(title)}`;

              for (const subscriber of subscribers) {
                await this.telegramService.sendDealNotificationToChat(subscriber.chatId, {
                  gameName: title,
                  newPrice: currentPrice,
                  oldPrice: lastPrice?.amount || currentPrice,
                  discountRate,
                  aiAnalysis: 'Fiyat düşüşü tespit edildi! 📉',
                  steamLink,
                  imageUrl: steamImageUrl,
                });
              }
              
              this.logger.log(`📱 ${subscribers.length} kullanıcıya "${title}" için bildirim gönderildi.`);
            }
          }
        } else {
          skippedCount++;
        }
      }

      this.logger.log(`📊 Özet: ${newPricesCount} yeni fiyat kaydedildi, ${skippedCount} değişmemiş fiyat atlandı.`);
      this.logger.log(`🔍 Toplam ${analysisCandidates.length} oyun AI analizi için aday gösterildi.`);

      // Batch İşleme (3'lü gruplar)
      const chunkSize = 3;
      for (let i = 0; i < analysisCandidates.length; i += chunkSize) {
        const chunk = analysisCandidates.slice(i, i + chunkSize);

        this.logger.debug(`Batch İşleniyor (${i + 1} - ${i + chunk.length} / ${analysisCandidates.length})...`);

        await this.pricesService.analyzeBatch(chunk);

        if (i + chunkSize < analysisCandidates.length) {
          this.logger.debug('Rate limit için 15 saniye bekleniyor...');
          await new Promise((resolve) => setTimeout(resolve, 15000));
        }
      }

      this.logger.log('✅ Günlük tarama başarıyla tamamlandı.');
    } catch (error) {
      this.logger.error('Scraper hatası:', error.message);
    }
  }

  async resetAllData() {
    this.logger.warn('TÜM VERİTABANI SİLİNİYOR VE YENİDEN OLUŞTURULUYOR...');
    await this.prisma.deal.deleteMany({});
    await this.prisma.price.deleteMany({});
    await this.prisma.game.deleteMany({});
    this.logger.log('Veritabanı temizlendi. Scraper başlatılıyor...');
    await this.handleCron();
    return { message: 'Database reset and seeded successfully' };
  }
}
