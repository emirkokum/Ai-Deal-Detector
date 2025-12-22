import { Controller, Post, Body, Get } from '@nestjs/common';
import { PricesService } from './prices.service';
import { AppendPriceDto } from './dto/append-price.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('prices')
export class PricesController {
  constructor(
    private readonly pricesService: PricesService,
    private readonly prisma: PrismaService,
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
}
