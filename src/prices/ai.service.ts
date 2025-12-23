import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private genAI: GoogleGenerativeAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is missing in .env file!');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async analyzeDeal(
    gameName: string,
    currentPrice: number,
    avgPrice: number,
    historicalLow: number,
  ) {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-lite',
      });

      const prompt = `
        Sen bir oyun fiyat analiz uzmanısın. Aşağıdaki verileri kullanarak bu indirimin "GERÇEK" mi yoksa "MANİPÜLASYON" (sahte indirim) mu olduğunu analiz et.
        
        Oyun: ${gameName}
        Anlık Fiyat: ${currentPrice} USD
        Son 90 Gün Ortalama Fiyat: ${avgPrice} USD
        Tarihsel En Düşük Fiyat: ${historicalLow} USD

        Kurallar:
        1. Eğer anlık fiyat ortalamanın üzerindeyse veya çok yakınsa bu bir sahte indirimdir.
        2. Analizini maksimum 15 kelimeyle yap.
        3. Cevabın sonunda şu formatta bir skor ver: [SCORE: 0-100]
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      this.logger.error('Gemini Analiz Hatası:', error.message);
      return 'Analiz yapılamadı.';
    }
  }
}
