import { Controller, Post, Body } from '@nestjs/common';
import { PricesService } from './prices.service';
import { AppendPriceDto } from './dto/append-price.dto';

@Controller('prices')
export class PricesController {
  constructor(private readonly pricesService: PricesService) {}

  @Post('append')
  async appendPrice(@Body() appendPriceDto: AppendPriceDto) {
    return this.pricesService.appendPrice(appendPriceDto);
  }
}
