"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, Boxes, ChevronDown, CreditCard, Megaphone, ShieldCheck, Store } from "lucide-react";

import { TIERS } from "@/lib/plans";
import { useAuth, useLang } from "@/components/providers";
import { TierCard } from "@/components/tier-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const FEATURES = [
  { icon: Store, key: "store" },
  { icon: CreditCard, key: "payments" },
  { icon: Boxes, key: "inventory" },
  { icon: Megaphone, key: "growth" },
] as const;

export default function LandingPage() {
  const { t } = useLang();
  const { user } = useAuth();

  return (
    <>
      {/* hero */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 pb-20 md:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="size-3.5" /> {t("hero.eyebrow")}
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-balance md:text-6xl">{t("hero.title")}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-pretty text-muted-foreground">{t("hero.subtitle")}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/market">
                {t("hero.ctaShop")} <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href={user ? "/workspace" : "/login?tab=signup&next=/pricing"}>{t("hero.ctaSell")}</Link>
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-3xl grid-cols-3 gap-4 text-center">
          {(["stat1", "stat2", "stat3"] as const).map((k) => (
            <div key={k} className="rounded-xl border bg-card/60 p-4">
              <div className="text-2xl font-bold md:text-3xl">{t(`hero.${k}.value`)}</div>
              <div className="mt-1 text-xs text-muted-foreground md:text-sm">{t(`hero.${k}.label`)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* features */}
      <section id="features" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16">
        <SectionHeading eyebrow={t("features.eyebrow")} title={t("features.title")} />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, key }) => (
            <Card key={key} className="transition-colors hover:border-white/25">
              <CardContent className="space-y-3">
                <div className="grid size-10 place-items-center rounded-lg bg-accent">
                  <Icon className="size-5" />
                </div>
                <h3 className="font-semibold">{t(`features.${key}.title`)}</h3>
                <p className="text-sm text-muted-foreground">{t(`features.${key}.desc`)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16">
        <SectionHeading eyebrow={t("how.eyebrow")} title={t("how.title")} align="left" />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {(["s1", "s2", "s3"] as const).map((s, i) => (
            <div key={s} className="flex gap-4 rounded-xl border bg-card p-5">
              <span className="text-3xl font-black text-muted-foreground/60">{`0${i + 1}`}</span>
              <div>
                <h3 className="font-semibold">{t(`how.${s}.title`)}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t(`how.${s}.desc`)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16">
        <SectionHeading eyebrow={t("pricing.eyebrow")} title={t("pricing.title")} />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TIERS.map((tier) => (
            <TierCard key={tier.code} tier={tier} href="/pricing" cta={tier.price === 0 ? t("tier.free.cta") : t("tier.getStarted")} />
          ))}
        </div>
      </section>

      {/* benefits */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <div className="grid items-start gap-10 rounded-2xl border bg-card/60 p-8 md:grid-cols-2 md:p-12">
          <div>
            <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{t("benefits.eyebrow")}</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance">{t("benefits.title")}</h2>
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <BarChart3 className="size-4" /> {t("benefits.note")}
            </div>
          </div>
          <div className="space-y-5">
            {(["b1", "b2", "b3"] as const).map((b) => (
              <div key={b}>
                <div className="font-semibold">{t(`benefits.${b}.title`)}</div>
                <p className="text-sm text-muted-foreground">{t(`benefits.${b}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* faq */}
      <section id="faq" className="mx-auto w-full max-w-3xl scroll-mt-20 px-4 py-16">
        <SectionHeading eyebrow={t("faq.eyebrow")} title={t("faq.title")} />
        <div className="mt-10 space-y-3">
          {(["q1", "q2", "q3", "q4"] as const).map((q, i) => (
            <details key={q} open={i === 0} className="group rounded-xl border bg-card px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {t(`faq.${q}.q`)}
                <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{t(`faq.${q}.a`)}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}

function SectionHeading({ eyebrow, title, align = "center" }: { eyebrow: string; title: string; align?: "center" | "left" }) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{eyebrow}</span>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance md:text-4xl">{title}</h2>
    </div>
  );
}
