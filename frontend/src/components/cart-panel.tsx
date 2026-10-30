"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { money } from "@/lib/format";
import type { PaymentIntent } from "@/lib/types";
import { PaymentDialog } from "@/components/payment-dialog";
import { useAuth, useCart, useLang } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Cart summary + simulated checkout. Used on /market (side panel) and /cart (full page). */
export function CartPanel({ className }: { className?: string }) {
  const { t, lang } = useLang();
  const cart = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [paying, setPaying] = React.useState(false);

  const createIntent = React.useCallback(
    () => api.post<PaymentIntent>("/orders/checkout", { items: cart.items.map((i) => ({ gamepass_id: i.id, quantity: i.qty })) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paying],
  );

  function checkout() {
    if (!cart.items.length) return void toast.error(t("cart.emptyAlert"));
    if (!user) {
      toast.info(t("cart.loginFirst"));
      return router.push("/login?next=/cart");
    }
    setPaying(true);
  }

  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{t("cart.title")}</CardTitle>
        <span className="text-sm text-muted-foreground" suppressHydrationWarning>
          {cart.count} {t(cart.count === 1 ? "cart.item" : "cart.items")}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        {cart.items.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t("cart.empty")}</p>
        ) : (
          <ul className="space-y-3">
            {cart.items.map((i) => (
              <li key={i.id} className="rounded-lg border bg-background/50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {lang === "th" ? i.game_th : i.game_en} • {lang === "th" ? i.name_th : i.name_en}
                    </div>
                    <div className="text-xs text-muted-foreground">{t("market.bySeller", { seller: i.seller })}</div>
                  </div>
                  <span className="text-sm font-semibold">{money(Number(i.price) * i.qty)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="size-7" onClick={() => cart.setQty(i.id, i.qty - 1)} aria-label="-">
                      <Minus className="size-3" />
                    </Button>
                    <span className="w-8 text-center text-sm">{i.qty}</span>
                    <Button variant="outline" size="icon" className="size-7" onClick={() => cart.setQty(i.id, i.qty + 1)} aria-label="+">
                      <Plus className="size-3" />
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => cart.remove(i.id)}>
                    <Trash2 /> {t("cart.remove")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-sm text-muted-foreground">{t("cart.subtotal")}</span>
          <strong className="text-lg" suppressHydrationWarning>{money(cart.subtotal)}</strong>
        </div>
        <Button className="w-full" size="lg" onClick={checkout} disabled={!cart.items.length}>
          {t("cart.checkout")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("cart.priceNote")}</p>
      </CardContent>
      <PaymentDialog
        open={paying}
        createIntent={createIntent}
        onClose={() => setPaying(false)}
        onPaid={() => {
          cart.clear();
          toast.success(t("cart.paid"));
        }}
      />
    </Card>
  );
}
