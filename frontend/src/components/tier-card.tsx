"use client";

import Link from "next/link";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { moneyShort } from "@/lib/format";
import type { Tier } from "@/lib/plans";
import { useLang } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TierCard({
  tier,
  cta,
  onSelect,
  href,
  disabled,
  current,
}: {
  tier: Tier;
  cta: string;
  onSelect?: () => void;
  href?: string;
  disabled?: boolean;
  current?: boolean;
}) {
  const { t } = useLang();
  return (
    <Card className={cn("relative h-full", tier.popular && "border-primary/60 bg-gradient-to-b from-white/[0.06] to-card")}>
      {tier.popular && <Badge className="absolute -top-3 left-5">{t("tier.popular")}</Badge>}
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          {t(`tier.${tier.code}.name`)}
          {current && <Badge variant="success">{t("tier.current")}</Badge>}
        </CardTitle>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-extrabold tracking-tight">{tier.price === 0 ? t("tier.freePrice") : moneyShort(tier.price)}</span>
          {tier.price > 0 && <span className="text-sm text-muted-foreground">{t("tier.perMonth")}</span>}
        </div>
        <p className="text-sm text-muted-foreground">{t(`tier.${tier.code}.desc`)}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5">
        <ul className="flex flex-1 flex-col gap-2.5 text-sm">
          {tier.features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
              <span>{t(f)}</span>
            </li>
          ))}
        </ul>
        {href ? (
          <Button asChild variant={tier.popular ? "default" : "secondary"} className="w-full">
            <Link href={href}>{cta}</Link>
          </Button>
        ) : (
          <Button variant={tier.popular ? "default" : "secondary"} className="w-full" onClick={onSelect} disabled={disabled}>
            {cta}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
