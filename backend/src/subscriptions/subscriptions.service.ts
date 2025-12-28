import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createOrUpdate(chatId: string, gameIds: string[]) {
    this.logger.log(`Subscription oluşturuluyor/güncelleniyor: chatId=${chatId}, ${gameIds.length} oyun`);

    return this.prisma.subscription.upsert({
      where: { chatId },
      create: {
        chatId,
        gameIds,
      },
      update: {
        gameIds,
        updatedAt: new Date(),
      },
    });
  }

  async findByChatId(chatId: string) {
    return this.prisma.subscription.findUnique({
      where: { chatId },
    });
  }

  async findByGameId(gameId: string) {
    return this.prisma.subscription.findMany({
      where: {
        gameIds: { has: gameId },
      },
    });
  }

  async getAllSubscriptions() {
    return this.prisma.subscription.findMany();
  }
}
