export type FlowKind = 'income' | 'expense'
export type Cadence = 'one_time' | 'recurring'

export interface Entry {
  id: string; user_id: string; title: string; category_id: string | null; category_name?: string; category_color?: string;
  amount: number; kind: FlowKind; cadence: Cadence; entry_date: string; note: string;
  installment_count: number | null; notification_enabled: boolean; created_at?: string
}

export interface Category {
  id: string; user_id: string; name: string; color: string; kind: FlowKind;
  one_time: boolean; recurring: boolean; created_at?: string
}

export interface Asset {
  id: string; user_id: string; name: string; symbol: string; kind: string;
  units: number; average_cost: number; current_price: number; purchase_date?: string | null; created_at?: string;
  source_ids?: string[]
}

export interface AssetTransaction {
  id: string; user_id: string; asset_id: string; side: 'buy' | 'sell';
  units: number; unit_price: number; transaction_date: string; created_at?: string
}

export const defaultCategories: Omit<Category, 'id' | 'user_id'>[] = [
  { name: 'Market', color: '#e0564a', kind: 'expense', one_time: true, recurring: false },
  { name: 'Ulaşım', color: '#e39a31', kind: 'expense', one_time: true, recurring: false },
  { name: 'Sağlık', color: '#3f8f74', kind: 'expense', one_time: true, recurring: false },
  { name: 'Eğlence', color: '#8b66b2', kind: 'expense', one_time: true, recurring: false },
  { name: 'Kira', color: '#c84941', kind: 'expense', one_time: false, recurring: true },
  { name: 'Faturalar', color: '#3b75a5', kind: 'expense', one_time: false, recurring: true },
  { name: 'Abonelikler', color: '#8360a4', kind: 'expense', one_time: false, recurring: true },
  { name: 'Maaş', color: '#27865c', kind: 'income', one_time: false, recurring: true },
  { name: 'Ek gelir', color: '#3f8f74', kind: 'income', one_time: true, recurring: false },
  { name: 'Yatırım getirisi', color: '#3d73a8', kind: 'income', one_time: true, recurring: true }
]
