import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';

export interface DealNotification {
  gameName: string;
  newPrice: number;
  oldPrice: number;
  discountRate: number;
  aiAnalysis: string;
  steamLink: string;
  imageUrl?: string;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Telegraf | null = null;
  private chatId: string | null = null;

  constructor(private configService: ConfigService) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.chatId = this.configService.get<string>('TELEGRAM_CHAT_ID') || null;

    if (token && this.chatId) {
      this.bot = new Telegraf(token);
      this.logger.log('Telegram Bot başarıyla yapılandırıldı.');
    } else {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN veya TELEGRAM_CHAT_ID eksik. Telegram bildirimleri devre dışı.',
      );
    }
  }

  async sendDealNotification(deal: DealNotification): Promise<boolean> {
    if (!this.bot || !this.chatId) {
      this.logger.debug('Telegram yapılandırılmamış, bildirim atlandı.');
      return false;
    }

    const message = `
🚀 *EFSANE FIRSAT YAKALANDI!*

🎮 *Oyun:* ${this.escapeMarkdown(deal.gameName)}
💰 *Fiyat:* ${deal.newPrice}$ _(Eski: ${deal.oldPrice}$)_
📉 *İndirim:* %${deal.discountRate}
🧠 *AI Analizi:* ${this.escapeMarkdown(deal.aiAnalysis)}

🔗 [Steam'de Görüntüle](${deal.steamLink})
    `.trim();

    try {
      if (deal.imageUrl) {
        await this.bot.telegram.sendPhoto(this.chatId, deal.imageUrl, {
          caption: message,
          parse_mode: 'Markdown',
        });
      } else {
        await this.bot.telegram.sendMessage(this.chatId, message, {
          parse_mode: 'Markdown',
        });
      }

      this.logger.log(`Telegram bildirimi gönderildi: ${deal.gameName}`);
      return true;
    } catch (error) {
      this.logger.error(`Telegram bildirimi gönderilemedi: ${error.message}`);
      return false;
    }
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  }

  // Belirli bir chatId'ye bildirim gönder (kullanıcı bazlı)
  async sendDealNotificationToChat(chatId: string, deal: DealNotification): Promise<boolean> {
    if (!this.bot) {
      this.logger.debug('Telegram bot yapılandırılmamış, bildirim atlandı.');
      return false;
    }

    const message = `
🔔 *FAVORİ OYUNUNUZDA FİYAT DÜŞTÜ!*

🎮 *Oyun:* ${this.escapeMarkdown(deal.gameName)}
💰 *Fiyat:* ${deal.newPrice}$ _(Eski: ${deal.oldPrice}$)_
📉 *İndirim:* %${deal.discountRate}
🧠 *Not:* ${this.escapeMarkdown(deal.aiAnalysis)}

🔗 [Steam'de Görüntüle](${deal.steamLink})
    `.trim();

    try {
      if (deal.imageUrl) {
        await this.bot.telegram.sendPhoto(chatId, deal.imageUrl, {
          caption: message,
          parse_mode: 'Markdown',
        });
      } else {
        await this.bot.telegram.sendMessage(chatId, message, {
          parse_mode: 'Markdown',
        });
      }

      this.logger.debug(`Kullanıcı bildirimi gönderildi (chatId: ${chatId}): ${deal.gameName}`);
      return true;
    } catch (error) {
      this.logger.error(`Kullanıcı bildirimi gönderilemedi (chatId: ${chatId}): ${error.message}`);
      return false;
    }
  }

  async sendTestMessage(): Promise<boolean> {
    if (!this.bot || !this.chatId) {
      this.logger.warn('Telegram yapılandırılmamış, test mesajı gönderilemedi.');
      return false;
    }

    try {
      await this.bot.telegram.sendMessage(
        this.chatId,
        `🧪 *Test Mesajı*\n\nAI Deal Detector Telegram entegrasyonu başarıyla çalışıyor! ✅\n\n_Tarih: ${new Date().toLocaleString('tr-TR')}_`,
        { parse_mode: 'Markdown' },
      );
      this.logger.log('Test mesajı başarıyla gönderildi.');
      return true;
    } catch (error) {
      this.logger.error(`Test mesajı gönderilemedi: ${error.message}`);
      return false;
    }
  }
}
