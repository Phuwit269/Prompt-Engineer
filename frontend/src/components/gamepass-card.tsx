"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { money } from "@/lib/format";
import type { Gamepass } from "@/lib/types";
import { useCart, useLang } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function GamepassCard({ pass }: { pass: Gamepass }) {
  const { t, lang } = useLang();
  const cart = useCart();
  const name = lang === "th" ? pass.name_th : pass.name_en;
  return (
    <Card className="gap-4 transition-colors hover:border-white/25">
      <CardContent className="flex h-full flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          {pass.badge ? <Badge variant={pass.badge === "hot" ? "destructive" : pass.badge === "limited" ? "warning" : "info"}>{t(`badge.${pass.badge}`)}</Badge> : <span />}
          <span className="text-lg font-bold">{money(pass.price)}</span>
        </div>
        <div className="flex-1">
          <h4 className="font-semibold">{name}</h4>
          <p className="text-sm text-muted-foreground">{t("market.bySeller", { seller: pass.seller_name })}</p>
        </div>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={() => {
              cart.add(pass);
              toast.success(t("market.added", { name }));
            }}
          >
            <ShoppingCart /> {t("market.buy")}
          </Button>
          <Button variant="secondary" asChild>
            <Link href={`/market/${pass.id}`}>{t("market.details")}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
