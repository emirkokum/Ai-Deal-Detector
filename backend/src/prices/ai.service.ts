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

  async analyzeDealsBatch(
    items: {
      gameName: string;
      currentPrice: number;
      avgPrice: number;
      historicalLow: number;
      gameId: string;
    }[],
  ): Promise<
    {
      gameId: string;
      score: number;
      reasoning: string;
    }[]
  > {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
      });

      const itemsPrompt = items
        .map(
          (item, index) => `
        Item ${index + 1}:
        ID: ${item.gameId}
        Game: ${item.gameName}
        Current: ${item.currentPrice}
        Avg: ${item.avgPrice}
        Low: ${item.historicalLow}
      `,
        )
        .join('\n');

      const prompt = `
        You are a game price analysis expert. Analyze these ${items.length} deals.
        For each, decide if it is "REAL" or "MANIPULATED".
        
        Rules:
        1. If current price > average or close to it -> MANIPULATED.
        2. If current price <= historical low -> REAL (Score 100).
        3. Max 15 words reasoning per item.
        
        Input Data:
        ${itemsPrompt}

        Output **ONLY** a raw JSON array (no markdown formatting, no backticks) with this structure:
        [
          { "gameId": "...", "score": 0-100, "reasoning": "..." }
        ]
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().replace(/```json|```/g, '').trim();
      
      return JSON.parse(text);
    } catch (error) {
      this.logger.error('Gemini Batch Analysis Failed:', error.message);
      throw error;
    }
  }
}
