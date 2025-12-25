import { Module } from '@nestjs/common';
import { PricesController } from './prices.controller';
import { PricesService } from './prices.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ScraperService } from 'src/scraper/scraper.service';
import { HttpModule } from '@nestjs/axios';
import { AIService } from './ai.service';

@Module({
  imports: [HttpModule],
  controllers: [PricesController],
  providers: [PricesService, PrismaService, ScraperService, AIService],
})
export class PricesModule {}
