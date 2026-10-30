"use client";

/* eslint-disable react-hooks/set-state-in-effect -- effects here intentionally sync external state (localStorage / API) into React state */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Minus } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { TIERS } from "@/lib/plans";
import type { PaymentIntent, Plan, Subscription } from "@/lib/types";
import { PaymentDialog } from "@/components/payment-dialog";
import { useAuth, useLang } from "@/components/providers";
import { TierCard } from "@/components/tier-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function PricingPage() {
  const { t } = useLang();
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [sub, setSub] = React.useState<Subscription | null>(null);
  const [planCode, setPlanCode] = React.useState<string | null>(null);

  React.useEffect(() => {
    api.get<Plan[]>("/plans").then(setPlans).catch(() => {});
  }, []);
  React.useEffect(() => {
    if (user) api.get<Subscription | null>("/subscriptions/me").then(setSub).catch(() => {});
    else setSub(null);
  }, [user]);

  const createIntent = React.useCallback(
    () => api.post<PaymentIntent>("/subscriptions/checkout", { plan_code: planCode }),
    [planCode],
  );

  function choose(code: string) {
    if (!user) {
      toast.info(t("pricing.loginFirst"));
      return router.push("/login?tab=signup&next=/pricing");
    }
    if (user.role === "admin") return void toast.info(t("pricing.adminNote"));
    setPlanCode(code);
  }

  const rate = (code: string) => {
    const p = plans.find((x) => x.code === code);
    return p ? `${Math.round(Number(p.commission_rate) * 1000) / 10}%` : "—";
  };

  const rows: { label: string; values: (React.ReactNode)[] }[] = [
    { label: t("cmp.browse"), values: [true, true, true] },
    { label: t("cmp.checkout"), values: [true, true, true] },
    { label: t("cmp.listings"), values: ["0", "1", t("cmp.unlimited")] },
    { label: t("cmp.commission"), values: ["—", rate("creator_lite"), rate("creator_pro")] },
    { label: t("cmp.dashboard"), values: [false, true, true] },
    { label: t("cmp.analytics"), values: [false, false, true] },
    { label: t("cmp.support"), values: [t("cmp.community"), t("cmp.email"), t("cmp.priority")] },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{t("pricing.eyebrow")}</span>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-balance">{t("pricing.pageTitle")}</h1>
        <p className="mt-3 text-muted-foreground">{t("pricing.pageDesc")}</p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {TIERS.map((tier) => {
          const isCurrent = tier.code === "free" ? !!user && user.role !== "admin" && !sub : sub?.plan.code === tier.code;
          const lowerThanCurrent = tier.code !== "free" && !!sub && Number(sub.plan.price_thb) > tier.price;
          return (
            <TierCard
              key={tier.code}
              tier={tier}
              current={isCurrent}
              href={tier.code === "free" && !user ? "/login?tab=signup" : undefined}
              disabled={tier.code === "free" || isCurrent || lowerThanCurrent}
              onSelect={() => choose(tier.code)}
              cta={
                tier.code === "free"
                  ? user ? t("tier.included") : t("tier.free.cta")
                  : isCurrent ? t("tier.current") : sub && !lowerThanCurrent ? t("tier.upgradeTo") : t("tier.subscribe")
              }
            />
          );
        })}
      </div>

      <Card className="mt-14">
        <CardHeader><CardTitle>{t("cmp.title")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("cmp.feature")}</TableHead>
                {TIERS.map((x) => <TableHead key={x.code} className="text-center">{t(`tier.${x.code}.name`)}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.label}>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  {r.values.map((v, i) => (
                    <TableCell key={i} className="text-center">
                      {v === true ? <Check className="mx-auto size-4 text-emerald-400" /> : v === false ? <Minus className="mx-auto size-4 text-muted-foreground" /> : v}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PaymentDialog
        open={!!planCode}
        createIntent={createIntent}
        onClose={() => {
          const upgraded = !!planCode && user?.role === "pro";
          setPlanCode(null);
          if (upgraded) router.push("/workspace");
        }}
        onPaid={async () => {
          await refresh(); // role is now "pro" — unlocks the workspace
          api.get<Subscription | null>("/subscriptions/me").then(setSub).catch(() => {});
          toast.success(t("pricing.upgraded"));
        }}
      />
    </div>
  );
}
