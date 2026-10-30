"use client";

import * as React from "react";
import Link from "next/link";
import { Folder, Search } from "lucide-react";

import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Game, Gamepass } from "@/lib/types";
import { CartPanel } from "@/components/cart-panel";
import { GamepassCard } from "@/components/gamepass-card";
import { useLang } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export default function MarketPage() {
  const { t, lang } = useLang();
  const [games, setGames] = React.useState<Game[] | null>(null);
  const [passes, setPasses] = React.useState<Gamepass[]>([]);
  const [error, setError] = React.useState("");
  const [selected, setSelected] = React.useState<number | null>(null);
  const [q, setQ] = React.useState("");

  React.useEffect(() => {
    Promise.all([api.get<Game[]>("/games"), api.get<Gamepass[]>("/gamepasses?limit=200")])
      .then(([g, p]) => {
        setGames(g);
        setPasses(p);
        setSelected((cur) => cur ?? g[0]?.id ?? null);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const query = q.trim().toLowerCase();
  const visible = passes.filter(
    (p) => (query ? p.name_en.toLowerCase().includes(query) || p.name_th.toLowerCase().includes(query) || p.game_name_en.toLowerCase().includes(query) : p.game_id === selected),
  );
  const selectedGame = games?.find((g) => g.id === selected);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{t("market.eyebrow")}</span>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{t("market.title")}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-lg border bg-muted p-1 text-sm">
            <span className="rounded-md bg-primary px-3 py-1.5 font-medium whitespace-nowrap text-primary-foreground">{t("market.modeBuy")}</span>
            <Link href="/workspace" className="rounded-md px-3 py-1.5 whitespace-nowrap text-muted-foreground hover:text-foreground">
              {t("market.modeCreate")}
            </Link>
          </div>
          <Button variant="secondary" asChild>
            <Link href="/pricing">{t("market.becomeSeller")}</Link>
          </Button>
        </div>
      </div>

      {error && <p className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-red-300">{error}</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input className="pl-9" placeholder={t("market.search")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("market.search")} />
          </div>

          <section aria-label={t("market.folders")}>
            {games === null ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
              </div>
            ) : games.length === 0 ? (
              <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{t("market.empty")}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {games.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setSelected(g.id);
                      setQ("");
                    }}
                    className={cn(
                      `accent-${g.accent % 6} flex cursor-pointer items-center gap-3 rounded-xl p-4 text-left text-black transition-all hover:-translate-y-0.5`,
                      selected === g.id && !query ? "ring-2 ring-white ring-offset-2 ring-offset-background" : "opacity-85",
                    )}
                  >
                    <Folder className="size-6 shrink-0" />
                    <span className="min-w-0">
                      <strong className="block truncate">{lang === "th" ? g.name_th : g.name_en}</strong>
                      <small className="block truncate opacity-70">
                        {lang === "th" ? g.category_th : g.category_en} · {g.pass_count}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-4">
              <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                {query ? t("market.results") : t("market.selected")}
              </span>
              <h2 className="text-xl font-semibold">{query ? `“${q}”` : selectedGame ? (lang === "th" ? selectedGame.name_th : selectedGame.name_en) : t("market.choose")}</h2>
            </div>
            {visible.length === 0 && games !== null ? (
              <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{t("market.noPasses")}</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {visible.map((p) => <GamepassCard key={p.id} pass={p} />)}
              </div>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <CartPanel />
        </aside>
      </div>
    </div>
  );
}
