import {
  IsString,
  IsNumber,
  IsPositive,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';

export class AppendPriceDto {
  @IsUUID()
  @IsNotEmpty()
  gameId: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsString()
  @IsNotEmpty()
  source: string;
}
