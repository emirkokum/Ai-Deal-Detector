export interface GameDeal {
  id: string;
  title: string;
  score: number;
  currentPrice: number;
  oldPrice: number;
  discountRate: number;
  image: string;
  analysis: string;
  link: string;
  externalId?: string | null;
  fallbackImage?: string | null;
  updatedAt: Date | string;
}
