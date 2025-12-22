import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import { PricesService } from 'src/prices/prices.service';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly pricesService: PricesService,
    private readonly prisma: PrismaService,
  ) {}

  // Test için her 10 saniyede bir çalışsın (Gerçekte CronExpression.EVERY_HOUR yapabilirsin)
  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleCron() {
    this.logger.debug('CheapShark API üzerinden veriler çekiliyor...');

    try {
      const response = await firstValueFrom(
        this.httpService.get(
          'https://www.cheapshark.com/api/1.0/deals?storeID=1&pageSize=20',
        ),
      );

      for (const deal of response.data as any[]) {
        const gameName = String(deal.title || 'Unknown Game');
        this.logger.debug(`İşlenen oyun: ${deal.title}`);
        let game = await this.prisma.game.findFirst({
          where: { name: gameName },
        });

        if (!game) {
          game = await this.prisma.game.create({
            data: {
              name: gameName,
              platform: 'PC',
            },
          });
        }

        await this.pricesService.appendPrice({
          gameId: game.id,
          amount: parseFloat(deal.salePrice),
          currency: 'USD',
          source: 'Steam', // Platform PC olsa da kaynağımız Steam
        });
      }

      this.logger.log('Veri senkronizasyonu başarıyla tamamlandı.');
    } catch (error) {
      this.logger.error('Scraper hatası:', error.message);
    }
  }
}
