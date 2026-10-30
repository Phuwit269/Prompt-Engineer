export type Role = "admin" | "free" | "pro";

export interface User {
  id: number;
  email: string;
  display_name: string;
  shop_name: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface Game {
  id: number;
  name_en: string;
  name_th: string;
  category_en: string;
  category_th: string;
  accent: number;
  pass_count: number;
}

export interface Gamepass {
  id: number;
  game_id: number;
  game_name_en: string;
  game_name_th: string;
  seller_id: number;
  seller_name: string;
  name_en: string;
  name_th: string;
  description: string;
  price: string; // Decimal serialised as string
  badge: "new" | "hot" | "limited" | null;
  is_active: boolean;
  created_at: string;
}

export interface Plan {
  id: number;
  code: string;
  name: string;
  price_thb: string;
  max_listings: number | null;
  commission_rate: string;
  duration_days: number;
}

export interface Subscription {
  id: number;
  plan: Plan;
  status: "pending" | "active" | "expired" | "cancelled";
  start_at: string | null;
  end_at: string | null;
}

export interface PaymentIntent {
  reference: string;
  kind: "order" | "subscription";
  amount: string;
  currency: string;
  status: "pending" | "succeeded" | "failed";
  qr_payload: string;
  description: string;
}

export interface Transaction {
  id: number;
  user_id: number;
  kind: "order" | "subscription";
  amount: string;
  currency: string;
  status: "pending" | "succeeded" | "failed";
  provider: string;
  reference: string;
  order_id: number | null;
  subscription_id: number | null;
  created_at: string;
  paid_at: string | null;
}

export interface Order {
  id: number;
  total: string;
  status: "pending" | "paid" | "cancelled";
  created_at: string;
  paid_at: string | null;
  items: { id: number; gamepass_id: number; gamepass_name: string; unit_price: string; quantity: number }[];
}

export interface SellerSummary {
  active_listings: number;
  listing_limit: number | null;
  plan_name: string | null;
  plan_end_at: string | null;
  units_sold: number;
  gross_sales: string;
  commission_paid: string;
  net_earnings: string;
}

export interface Analytics {
  window_days: number;
  kpis: {
    total_users: number;
    new_users: number;
    active_subscriptions: number;
    mrr: number;
    arr: number;
    gmv: number;
    commission_revenue: number;
    subscription_revenue: number;
    platform_revenue: number;
    transaction_count: number;
    transaction_volume: number;
    conversion_rate: number;
    active_listings: number;
  };
  users_by_role: { role: Role; count: number }[];
  plan_mix: { plan: string; count: number }[];
  daily: {
    date: string;
    signups: number;
    gmv: number;
    subscription_revenue: number;
    commission: number;
    platform_revenue: number;
    mrr: number;
  }[];
  top_gamepasses: { id: number; name: string; game: string; units: number; revenue: number }[];
  top_games: { game: string; units: number; revenue: number }[];
  top_sellers: { id: number; seller: string; units: number; revenue: number }[];
}
