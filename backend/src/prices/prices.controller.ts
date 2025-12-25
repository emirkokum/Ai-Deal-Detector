import { Controller, Post, Body, Get } from '@nestjs/common';
import { PricesService } from './prices.service';
import { AppendPriceDto } from './dto/append-price.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ScraperService } from 'src/scraper/scraper.service';

@Controller('prices')
export class PricesController {
  constructor(
    private readonly pricesService: PricesService,
    private readonly prisma: PrismaService,
    private readonly scraperService: ScraperService,
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
}
