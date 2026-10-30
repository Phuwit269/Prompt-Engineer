"use client";

import * as React from "react";
import Link from "next/link";
import { EyeOff, Loader2, Lock, Pencil, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api";
import { daysLeft, formatDate, money } from "@/lib/format";
import { TIERS } from "@/lib/plans";
import type { Game, Gamepass, SellerSummary } from "@/lib/types";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useLang } from "@/components/providers";
import { TierCard } from "@/components/tier-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type Badge_ = "new" | "hot" | "limited" | "none";
interface FormState { game: string; newGame: string; name_en: string; name_th: string; price: string; badge: Badge_; description: string }
const EMPTY: FormState = { game: "", newGame: "", name_en: "", name_th: "", price: "", badge: "new", description: "" };

export default function WorkspacePage() {
  const { user, loading, allowed } = useRequireAuth(["pro", "admin"]);

  if (loading) return <div className="mx-auto max-w-6xl space-y-4 px-4 py-10"><Skeleton className="h-10 w-72" /><Skeleton className="h-40" /></div>;
  if (!allowed) return <Paywall />;
  return <SellerWorkspace isAdmin={user!.role === "admin"} />;
}

function Paywall() {
  const { t } = useLang();
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12">
      <Card className="mx-auto max-w-2xl text-center">
        <CardHeader className="items-center">
          <div className="grid size-12 place-items-center rounded-full bg-accent"><Lock className="size-5" /></div>
          <CardTitle className="text-2xl">{t("ws.paywall.title")}</CardTitle>
          <CardDescription>{t("ws.paywall.desc")}</CardDescription>
        </CardHeader>
      </Card>
      <div className="mx-auto mt-10 grid max-w-3xl gap-6 md:grid-cols-2">
        {TIERS.filter((x) => x.price > 0).map((tier) => (
          <TierCard key={tier.code} tier={tier} href="/pricing" cta={t("tier.choose")} />
        ))}
      </div>
    </div>
  );
}

function SellerWorkspace({ isAdmin }: { isAdmin: boolean }) {
  const { t, lang } = useLang();
  const [summary, setSummary] = React.useState<SellerSummary | null>(null);
  const [mine, setMine] = React.useState<Gamepass[] | null>(null);
  const [games, setGames] = React.useState<Game[]>([]);
  const [editing, setEditing] = React.useState<Gamepass | null>(null);
  const [deleting, setDeleting] = React.useState<Gamepass | null>(null);

  const load = React.useCallback(async () => {
    try {
      const [s, m, g] = await Promise.all([
        api.get<SellerSummary>("/seller/summary"),
        api.get<Gamepass[]>("/gamepasses/mine"),
        api.get<Game[]>("/games"),
      ]);
      setSummary(s);
      setMine(m);
      setGames(g);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => { void load(); }, [load]);

  const limitReached = !isAdmin && summary?.listing_limit != null && summary.active_listings >= summary.listing_limit;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10">
      <div>
        <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{t("ws.eyebrow")}</span>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{t("ws.title")}</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={t("ws.m.listings")} value={summary ? `${summary.active_listings}${summary.listing_limit != null ? ` / ${summary.listing_limit}` : " / ∞"}` : null} />
        <Metric label={t("ws.m.gross")} value={summary ? money(summary.gross_sales) : null} />
        <Metric label={t("ws.m.net")} value={summary ? money(summary.net_earnings) : null} hint={summary ? t("ws.m.fee", { fee: money(summary.commission_paid) }) : undefined} />
        <Metric
          label={t("ws.m.plan")}
          value={summary ? (summary.plan_name ?? "—") : null}
          hint={summary?.plan_end_at ? t("ws.m.renews", { days: daysLeft(summary.plan_end_at), date: formatDate(summary.plan_end_at, lang) }) : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <CreateForm games={games} disabled={limitReached} onCreated={load} />
        <Card>
          <CardHeader>
            <CardTitle>{t("ws.list.title")}</CardTitle>
            <CardDescription>{t("ws.list.desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {mine === null ? (
              <Skeleton className="h-32" />
            ) : mine.length === 0 ? (
              <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{t("ws.list.empty")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("ws.col.pass")}</TableHead>
                    <TableHead>{t("ws.col.price")}</TableHead>
                    <TableHead>{t("ws.col.status")}</TableHead>
                    <TableHead className="text-right">{t("ws.col.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mine.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{lang === "th" ? p.name_th : p.name_en}</div>
                        <div className="text-xs text-muted-foreground">{lang === "th" ? p.game_name_th : p.game_name_en}</div>
                      </TableCell>
                      <TableCell>{money(p.price)}</TableCell>
                      <TableCell>{p.is_active ? <Badge variant="success">{t("ws.active")}</Badge> : <Badge variant="secondary"><EyeOff className="size-3" />{t("ws.hidden")}</Badge>}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" aria-label={t("common.edit")} onClick={() => setEditing(p)}><Pencil /></Button>
                          <Button size="icon" variant="ghost" aria-label={t("common.delete")} onClick={() => setDeleting(p)}><Trash2 /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <EditDialog pass={editing} onClose={() => setEditing(null)} onSaved={load} />
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("ws.delete.title")}</DialogTitle>
            <DialogDescription>{t("ws.delete.desc", { name: deleting ? (lang === "th" ? deleting.name_th : deleting.name_en) : "" })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleting(null)}>{t("common.cancel")}</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  await api.del(`/gamepasses/${deleting!.id}`);
                  toast.success(t("ws.deleted"));
                  setDeleting(null);
                  void load();
                } catch (e) { toast.error(errorMessage(e)); }
              }}
            >
              {t("ws.delete.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string | null; hint?: string }) {
  return (
    <Card className="gap-2">
      <CardContent>
        <div className="text-sm text-muted-foreground">{label}</div>
        {value === null ? <Skeleton className="mt-2 h-8 w-24" /> : <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>}
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function validate(f: FormState, t: (k: string) => string) {
  const e: Partial<Record<keyof FormState, string>> = {};
  if (!f.game) e.game = t("ws.err.game");
  if (f.game === "new" && f.newGame.trim().length < 2) e.newGame = t("ws.err.newGame");
  if (f.name_en.trim().length < 2) e.name_en = t("ws.err.name");
  const price = Number(f.price);
  if (!f.price || !Number.isFinite(price) || price <= 0) e.price = t("ws.err.price");
  return e;
}

function CreateForm({ games, disabled, onCreated }: { games: Game[]; disabled: boolean; onCreated: () => void }) {
  const { t, lang } = useLang();
  const [f, setF] = React.useState<FormState>(EMPTY);
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [busy, setBusy] = React.useState(false);
  const errors = validate(f, t);
  const err = (k: keyof FormState) => (touched[k] ? errors[k] : undefined);
  const touch = (k: keyof FormState) => setTouched((p) => ({ ...p, [k]: true }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ game: true, newGame: true, name_en: true, price: true });
    if (Object.keys(errors).length) return;
    setBusy(true);
    try {
      await api.post("/gamepasses", {
        game_id: f.game === "new" ? null : Number(f.game),
        new_game_name: f.game === "new" ? f.newGame.trim() : null,
        name_en: f.name_en.trim(),
        name_th: f.name_th.trim() || null,
        description: f.description.trim(),
        price: Number(f.price).toFixed(2),
        badge: f.badge === "none" ? null : f.badge,
      });
      toast.success(t("ws.created"));
      setF(EMPTY);
      setTouched({});
      onCreated();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const Err = (k: keyof FormState) => (err(k) ? <p className="text-xs text-red-400">{err(k)}</p> : null);

  return (
    <Card className="self-start">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><PlusCircle className="size-5" />{t("ws.form.title")}</CardTitle>
        <CardDescription>{t("ws.form.desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        {disabled && (
          <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
            {t("ws.limit")} <Link href="/pricing" className="font-semibold underline">{t("nav.upgrade")}</Link>
          </div>
        )}
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="game">{t("ws.f.game")}</Label>
            <Select value={f.game} onValueChange={(v) => { setF({ ...f, game: v }); touch("game"); }} disabled={disabled}>
              <SelectTrigger id="game" aria-invalid={!!err("game")}><SelectValue placeholder={t("ws.f.gamePlaceholder")} /></SelectTrigger>
              <SelectContent>
                {games.map((g) => <SelectItem key={g.id} value={String(g.id)}>{lang === "th" ? g.name_th : g.name_en}</SelectItem>)}
                <SelectItem value="new">＋ {t("ws.f.newGame")}</SelectItem>
              </SelectContent>
            </Select>
            {Err("game")}
          </div>
          {f.game === "new" && (
            <div className="space-y-2">
              <Label htmlFor="newGame">{t("ws.f.newGameName")}</Label>
              <Input id="newGame" placeholder="Blox City" value={f.newGame} onChange={(e) => setF({ ...f, newGame: e.target.value })} onBlur={() => touch("newGame")} disabled={disabled} aria-invalid={!!err("newGame")} />
              {Err("newGame")}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name_en">{t("ws.f.name")}</Label>
            <Input id="name_en" placeholder="VIP Pass" value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} onBlur={() => touch("name_en")} disabled={disabled} aria-invalid={!!err("name_en")} />
            {Err("name_en")}
          </div>
          <div className="space-y-2">
            <Label htmlFor="name_th">{t("ws.f.nameTh")} <span className="text-xs font-normal text-muted-foreground">({t("common.optional")})</span></Label>
            <Input id="name_th" placeholder="วีไอพีเพส" value={f.name_th} onChange={(e) => setF({ ...f, name_th: e.target.value })} disabled={disabled} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="price">{t("ws.f.price")}</Label>
              <Input id="price" type="number" min="1" step="1" inputMode="decimal" placeholder="299" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} onBlur={() => touch("price")} disabled={disabled} aria-invalid={!!err("price")} />
              {Err("price")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="badge">{t("ws.f.badge")}</Label>
              <Select value={f.badge} onValueChange={(v) => setF({ ...f, badge: v as Badge_ })} disabled={disabled}>
                <SelectTrigger id="badge"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["new", "hot", "limited", "none"] as const).map((b) => <SelectItem key={b} value={b}>{t(`badge.${b}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{t("ws.f.desc")}</Label>
            <Textarea id="description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} disabled={disabled} />
          </div>
          <Button type="submit" className="w-full" disabled={busy || disabled}>
            {busy && <Loader2 className="animate-spin" />} {t("ws.f.submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* eslint-disable react-hooks/set-state-in-effect */
function EditDialog({ pass, onClose, onSaved }: { pass: Gamepass | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useLang();
  const [f, setF] = React.useState({ name_en: "", name_th: "", price: "", badge: "none" as Badge_, description: "", is_active: true });
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (pass) setF({ name_en: pass.name_en, name_th: pass.name_th, price: String(Number(pass.price)), badge: pass.badge ?? "none", description: pass.description, is_active: pass.is_active });
  }, [pass]);
  const priceOk = Number(f.price) > 0;

  async function save() {
    if (!pass || !priceOk || f.name_en.trim().length < 2) return void toast.error(t("ws.err.name"));
    setBusy(true);
    try {
      await api.patch(`/gamepasses/${pass.id}`, {
        name_en: f.name_en.trim(), name_th: f.name_th.trim() || f.name_en.trim(), description: f.description,
        price: Number(f.price).toFixed(2), badge: f.badge === "none" ? null : f.badge, is_active: f.is_active,
      });
      toast.success(t("ws.saved"));
      onClose();
      onSaved();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <Dialog open={!!pass} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("ws.edit.title")}</DialogTitle><DialogDescription>{pass?.game_name_en}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label htmlFor="e-name">{t("ws.f.name")}</Label><Input id="e-name" value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="e-name-th">{t("ws.f.nameTh")}</Label><Input id="e-name-th" value={f.name_th} onChange={(e) => setF({ ...f, name_th: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label htmlFor="e-price">{t("ws.f.price")}</Label><Input id="e-price" type="number" min="1" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} aria-invalid={!priceOk} /></div>
            <div className="space-y-2">
              <Label>{t("ws.f.badge")}</Label>
              <Select value={f.badge} onValueChange={(v) => setF({ ...f, badge: v as Badge_ })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(["new", "hot", "limited", "none"] as const).map((b) => <SelectItem key={b} value={b}>{t(`badge.${b}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label htmlFor="e-desc">{t("ws.f.desc")}</Label><Textarea id="e-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-white" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />
            {t("ws.f.visible")}
          </label>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="animate-spin" />}{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
