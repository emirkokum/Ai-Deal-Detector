import { Controller, Post, Body, Get } from '@nestjs/common';
import { PricesService } from './prices.service';
import { AppendPriceDto } from './dto/append-price.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ScraperService } from 'src/scraper/scraper.service';
import { TelegramService } from 'src/telegram/telegram.service';

@Controller('prices')
export class PricesController {
  constructor(
    private readonly pricesService: PricesService,
    private readonly prisma: PrismaService,
    private readonly scraperService: ScraperService,
    private readonly telegramService: TelegramService,
  ) {}

  @Post('append')
  async appendPrice(@Body() appendPriceDto: AppendPriceDto) {
    return this.pricesService.appendPrice(appendPriceDto);
  }

  @Get('deals')
  async getAllDeals() {
    return this.prisma.deal.findMany({
      include: { game: true },
      orderBy: { dealScore: 'desc' },
    });
  }

  // prices.controller.ts
  @Get('best-deals')
  async getBestDeals() {
    return this.pricesService.getBestDeals();
  }

  @Post('reset-db')
  async resetDatabase() {
    return this.scraperService.resetAllData();
  }

  @Post('test-telegram')
  async testTelegram() {
    const success = await this.telegramService.sendTestMessage();
    return {
      success,
      message: success
        ? 'Test mesajı Telegram\'a gönderildi!'
        : 'Telegram mesajı gönderilemedi. Loglara bakın.',
    };
  }
}
