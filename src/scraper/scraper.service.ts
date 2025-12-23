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

  async onModuleInit() {
    this.logger.log('Uygulama başladı, ilk tarama tetikleniyor...');
    await this.handleCron();
  }

  //@Cron(CronExpression.EVERY_HOUR)
  @Cron('*/10 * * * *') // Her 10 dakikada bir çalışır
  async handleCron() {
    this.logger.debug('Steam Fırsatları ve Veri Analizi Başladı...');

    try {
      const response = await firstValueFrom(
        this.httpService.get(
          'https://www.cheapshark.com/api/1.0/deals?storeID=1&pageSize=50',
        ),
      );

      for (const deal of response.data as any[]) {
        const title = String(deal.title);
        let game = await this.prisma.game.findFirst({ where: { name: title } });

        // 1. Oyunu Oluştur
        if (!game) {
          game = await this.prisma.game.create({
            data: { name: title, platform: 'PC' },
          });
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
        await this.pricesService.appendPrice({
          gameId: game.id,
          amount: parseFloat(deal.salePrice),
          currency: 'USD',
          source: 'Steam',
        });
      }
      this.logger.log('Senkronizasyon başarıyla tamamlandı.');
    } catch (error) {
      this.logger.error('Scraper hatası:', error.message);
    }
  }
}
