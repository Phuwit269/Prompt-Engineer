export interface Tier {
  code: "free" | "creator_lite" | "creator_pro";
  price: number;
  features: string[]; // i18n keys
  popular?: boolean;
}

export const TIERS: Tier[] = [
  { code: "free", price: 0, features: ["tier.free.f1", "tier.free.f2", "tier.free.f3"] },
  { code: "creator_lite", price: 199, features: ["tier.lite.f1", "tier.lite.f2", "tier.lite.f3", "tier.lite.f4"] },
  { code: "creator_pro", price: 499, popular: true, features: ["tier.pro.f1", "tier.pro.f2", "tier.pro.f3", "tier.pro.f4"] },
];
