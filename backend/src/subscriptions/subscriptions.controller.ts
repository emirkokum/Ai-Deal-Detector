import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';

class CreateSubscriptionDto {
  chatId: string;
  gameIds: string[];
}

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  async createOrUpdate(@Body() dto: CreateSubscriptionDto) {
    const subscription = await this.subscriptionsService.createOrUpdate(
      dto.chatId,
      dto.gameIds,
    );
    return {
      success: true,
      message: 'Subscription başarıyla kaydedildi.',
      subscription,
    };
  }

  @Get(':chatId')
  async getByChatId(@Param('chatId') chatId: string) {
    const subscription = await this.subscriptionsService.findByChatId(chatId);
    if (!subscription) {
      return { success: false, message: 'Subscription bulunamadı.' };
    }
    return { success: true, subscription };
  }
}
