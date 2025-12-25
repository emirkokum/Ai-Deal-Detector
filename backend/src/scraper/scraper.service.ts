import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import { PricesService } from '../prices/prices.service';
@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly pricesService: PricesService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    this.logger.debug('Steam Fırsatları ve Veri Analizi Başladı...');

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

      for (const deal of response.data as any[]) {
        const title = String(deal.title);
        let game = await this.prisma.game.findFirst({ where: { name: title } });
        const steamAppID = deal.steamAppID;
        const thumb = deal.thumb; 

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
           // Güncelleme mantığı
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

            // Baseline (Normal Fiyat)
            await this.prisma.price.create({
              data: {
                gameId: game.id,
                amount: normalPrice,
                currency: 'USD',
                source: 'Steam_Baseline',
                createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
              },
            });

            // Historical Low
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

        // 3. Güncel Fiyatı Ekle (Analizi tetikler)
        await this.pricesService.savePrice({
          gameId: game.id,
          amount: parseFloat(deal.salePrice),
          currency: 'USD',
          source: 'Steam',
        });

        // Analiz Adaylığı Kontrolü
        const eligibility = await this.pricesService.checkDealEligibility(
          game.id,
          parseFloat(deal.salePrice),
        );
        
        if (eligibility) {
          analysisCandidates.push(eligibility);
        }
      }

      this.logger.log(`Toplam ${analysisCandidates.length} oyun analiz için aday gösterildi.`);

      // Batch İşleme (3'lü gruplar) - Rate limit için düşürüldü
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

      this.logger.log('Senkronizasyon başarıyla tamamlandı.');
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
