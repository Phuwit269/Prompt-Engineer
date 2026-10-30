export function money(value: number | string): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function moneyShort(value: number | string): string {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(Number(value));
}

export function formatDate(iso: string | null | undefined, lang: "en" | "th" = "en"): string {
  if (!iso) return "—";
  // backend sends naive UTC timestamps
  const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  return d.toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function daysLeft(iso: string | null | undefined): number {
  if (!iso) return 0;
  const end = new Date(iso.endsWith("Z") ? iso : iso + "Z").getTime();
  return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
}
