import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppendPriceDto } from './dto/append-price.dto';
import type { Price } from '../../generated/prisma/client.js';

@Injectable()
export class PricesService {
  constructor(private prisma: PrismaService) {}

  async appendPrice(data: AppendPriceDto) {
    const lastPrice = await this.prisma.price.findFirst({
      where: {
        gameId: data.gameId,
        source: data.source,
        currency: data.currency,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (lastPrice && lastPrice.amount === data.amount) {
      return { message: 'Price is identical, skipping.' };
    }

    const newPrice = await this.prisma.price.create({
      data: {
        amount: data.amount,
        currency: data.currency,
        source: data.source,
        gameId: data.gameId,
      },
    });

    // Deal Detection'ı tetikle
    const deal = await this.detectDeal(newPrice);

    return {
      price: newPrice,
      dealCreated: !!deal,
      dealDetails: deal || null,
    };
  }

  private async detectDeal(newPrice: Price) {
    const previousPrice = await this.prisma.price.findFirst({
      where: {
        gameId: newPrice.gameId,
        id: { not: newPrice.id },
        currency: newPrice.currency,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!previousPrice) return null;

    const discountPct =
      ((previousPrice.amount - newPrice.amount) / previousPrice.amount) * 100;

    if (discountPct <= 0) return null;

    const absoluteMin = await this.prisma.price.findFirst({
      where: { gameId: newPrice.gameId, currency: newPrice.currency },
      orderBy: { amount: 'asc' },
    });

    const isHistoricalLow =
      newPrice.amount <= (absoluteMin?.amount || newPrice.amount);

    let dealScore = Math.round(discountPct);
    if (isHistoricalLow) dealScore += 20;
    if (dealScore > 100) dealScore = 100;

    return await this.prisma.deal.create({
      data: {
        gameId: newPrice.gameId,
        oldPrice: previousPrice.amount,
        newPrice: newPrice.amount,
        currency: newPrice.currency,
        discountPct: discountPct,
        dealScore: dealScore,
        isHistoricalLow: isHistoricalLow,
      },
    });
  }
}
