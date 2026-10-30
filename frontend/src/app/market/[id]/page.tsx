"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ShoppingCart, Store } from "lucide-react";
import { toast } from "sonner";

import { api, ApiError } from "@/lib/api";
import { formatDate, money } from "@/lib/format";
import type { Gamepass } from "@/lib/types";
import { useCart, useLang } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useLang();
  const cart = useCart();
  const router = useRouter();
  const [pass, setPass] = React.useState<Gamepass | null>(null);
  const [missing, setMissing] = React.useState(false);

  React.useEffect(() => {
    api
      .get<Gamepass>(`/gamepasses/${id}`)
      .then(setPass)
      .catch((e) => e instanceof ApiError && e.status === 404 && setMissing(true));
  }, [id]);

  if (missing)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">{t("detail.notFound")}</h1>
        <Button className="mt-6" asChild><Link href="/market">{t("detail.back")}</Link></Button>
      </div>
    );

  const name = pass ? (lang === "th" ? pass.name_th : pass.name_en) : "";
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link href="/market"><ArrowLeft /> {t("detail.back")}</Link>
      </Button>
      {!pass ? (
        <Skeleton className="h-72" />
      ) : (
        <Card>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{lang === "th" ? pass.game_name_th : pass.game_name_en}</Badge>
              {pass.badge && <Badge variant={pass.badge === "hot" ? "destructive" : pass.badge === "limited" ? "warning" : "info"}>{t(`badge.${pass.badge}`)}</Badge>}
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
              <p className="mt-3 text-muted-foreground">{pass.description || t("detail.noDescription")}</p>
            </div>
            <dl className="grid gap-4 rounded-xl border bg-background/50 p-4 text-sm sm:grid-cols-3">
              <div><dt className="text-muted-foreground">{t("detail.seller")}</dt><dd className="mt-1 flex items-center gap-1.5 font-medium"><Store className="size-4" />{pass.seller_name}</dd></div>
              <div><dt className="text-muted-foreground">{t("detail.price")}</dt><dd className="mt-1 text-xl font-bold">{money(pass.price)}</dd></div>
              <div><dt className="text-muted-foreground">{t("detail.listed")}</dt><dd className="mt-1 font-medium">{formatDate(pass.created_at, lang)}</dd></div>
            </dl>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="flex-1" onClick={() => { cart.add(pass); toast.success(t("market.added", { name })); }}>
                <ShoppingCart /> {t("detail.addToCart")}
              </Button>
              <Button size="lg" variant="secondary" onClick={() => { cart.add(pass); router.push("/cart"); }}>
                {t("detail.buyNow")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
