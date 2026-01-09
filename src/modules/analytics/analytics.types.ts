export interface CapitalDataPoint {
  date: Date;
  capital: string;
}

export interface CategoryStat {
  categoryId: string;
  categoryName: string;
  amount: string;
  color?: string | null;
}
