"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { api, errorMessage } from "@/lib/api";
import { daysLeft, formatDate, money } from "@/lib/format";
import type { Order, Subscription, Transaction, User } from "@/lib/types";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useAuth, useLang } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const statusVariant = { succeeded: "success", paid: "success", pending: "warning", failed: "destructive", cancelled: "destructive" } as const;

export default function ProfilePage() {
  const { t, lang } = useLang();
  const { user, loading } = useRequireAuth();
  const { setUser } = useAuth();
  const [sub, setSub] = React.useState<Subscription | null>(null);
  const [orders, setOrders] = React.useState<Order[] | null>(null);
  const [txs, setTxs] = React.useState<Transaction[] | null>(null);

  React.useEffect(() => {
    if (!user) return;
    api.get<Subscription | null>("/subscriptions/me").then(setSub).catch(() => {});
    api.get<Order[]>("/orders/me").then(setOrders).catch(() => setOrders([]));
    api.get<Transaction[]>("/payments").then(setTxs).catch(() => setTxs([]));
  }, [user]);

  if (loading || !user) return <div className="mx-auto max-w-4xl space-y-4 px-4 py-10"><Skeleton className="h-10 w-64" /><Skeleton className="h-64" /></div>;

  const roleVariant = user.role === "admin" ? "warning" : user.role === "pro" ? "success" : "secondary";
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("profile.title")}</h1>
          <p className="mt-1 text-muted-foreground">{user.email}</p>
        </div>
        <Badge variant={roleVariant} className="px-3 py-1 text-sm"><ShieldCheck className="size-4" />{t(`role.${user.role}`)}</Badge>
      </div>

      <Tabs defaultValue="account" className="mt-8">
        <TabsList className="flex-wrap">
          <TabsTrigger value="account">{t("profile.tab.account")}</TabsTrigger>
          <TabsTrigger value="plan">{t("profile.tab.plan")}</TabsTrigger>
          <TabsTrigger value="orders">{t("profile.tab.orders")}</TabsTrigger>
          <TabsTrigger value="payments">{t("profile.tab.payments")}</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-6">
          <AccountForm user={user} onSaved={setUser} />
          <PasswordForm />
        </TabsContent>

        <TabsContent value="plan">
          <Card>
            <CardHeader>
              <CardTitle>{t("profile.plan.title")}</CardTitle>
              <CardDescription>{t("profile.plan.desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <Info label={t("profile.plan.role")} value={t(`role.${user.role}`)} />
                <Info label={t("profile.plan.current")} value={user.role === "admin" ? "Admin" : sub ? sub.plan.name : t("tier.free.name")} />
                <Info label={t("profile.plan.expires")} value={sub?.end_at ? `${formatDate(sub.end_at, lang)} (${t("profile.plan.days", { days: daysLeft(sub.end_at) })})` : "—"} />
              </div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>{t(`rbac.${user.role}.1`)}</li>
                <li>{t(`rbac.${user.role}.2`)}</li>
                <li>{t(`rbac.${user.role}.3`)}</li>
              </ul>
              {user.role !== "admin" && (
                <Button asChild><Link href="/pricing">{sub ? t("profile.plan.manage") : t("nav.upgrade")}</Link></Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardContent>
              {orders === null ? <Skeleton className="h-32" /> : orders.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">{t("profile.orders.empty")} <Link href="/market" className="underline">{t("hero.ctaShop")}</Link></p>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>#</TableHead><TableHead>{t("profile.col.items")}</TableHead><TableHead>{t("profile.col.total")}</TableHead><TableHead>{t("ws.col.status")}</TableHead><TableHead>{t("profile.col.date")}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {orders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell>{o.id}</TableCell>
                        <TableCell className="max-w-xs text-sm">{o.items.map((i) => `${i.gamepass_name} ×${i.quantity}`).join(", ")}</TableCell>
                        <TableCell>{money(o.total)}</TableCell>
                        <TableCell><Badge variant={statusVariant[o.status]}>{t(`status.${o.status}`)}</Badge></TableCell>
                        <TableCell>{formatDate(o.created_at, lang)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardContent>
              {txs === null ? <Skeleton className="h-32" /> : txs.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">{t("profile.payments.empty")}</p>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>{t("profile.col.ref")}</TableHead><TableHead>{t("profile.col.type")}</TableHead><TableHead>{t("profile.col.total")}</TableHead><TableHead>{t("ws.col.status")}</TableHead><TableHead>{t("profile.col.date")}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {txs.map((x) => (
                      <TableRow key={x.id}>
                        <TableCell className="font-mono text-xs">{x.reference}</TableCell>
                        <TableCell>{t(`kind.${x.kind}`)}</TableCell>
                        <TableCell>{money(x.amount)}</TableCell>
                        <TableCell><Badge variant={statusVariant[x.status]}>{t(`status.${x.status}`)}</Badge></TableCell>
                        <TableCell>{formatDate(x.created_at, lang)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background/50 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function AccountForm({ user, onSaved }: { user: User; onSaved: (u: User) => void }) {
  const { t } = useLang();
  const [name, setName] = React.useState(user.display_name);
  const [shop, setShop] = React.useState(user.shop_name ?? "");
  const [busy, setBusy] = React.useState(false);
  const nameErr = name.trim().length < 2 ? t("auth.err.name") : "";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (nameErr) return;
    setBusy(true);
    try {
      onSaved(await api.patch<User>("/users/me", { display_name: name.trim(), shop_name: shop.trim() }));
      toast.success(t("profile.saved"));
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader><CardTitle>{t("profile.account.title")}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2" noValidate>
          <div className="space-y-2"><Label htmlFor="p-email">{t("auth.email")}</Label><Input id="p-email" value={user.email} disabled /></div>
          <div className="space-y-2"><Label htmlFor="p-name">{t("auth.name")}</Label><Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!nameErr} />{nameErr && <p className="text-xs text-red-400">{nameErr}</p>}</div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="p-shop">{t("profile.shop")}</Label><Input id="p-shop" value={shop} onChange={(e) => setShop(e.target.value)} placeholder="Pixel Forge Shop" /><p className="text-xs text-muted-foreground">{t("profile.shopHint")}</p></div>
          <div className="sm:col-span-2"><Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}{t("common.save")}</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordForm() {
  const { t } = useLang();
  const [cur, setCur] = React.useState("");
  const [next, setNext] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const nextErr = next && next.length < 8 ? t("auth.err.passwordShort") : "";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!cur || next.length < 8) return void toast.error(t("auth.err.passwordShort"));
    setBusy(true);
    try {
      await api.post("/users/me/password", { current_password: cur, new_password: next });
      toast.success(t("profile.pwChanged"));
      setCur(""); setNext("");
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader><CardTitle>{t("profile.pw.title")}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2" noValidate>
          <div className="space-y-2"><Label htmlFor="cur-pw">{t("profile.pw.current")}</Label><Input id="cur-pw" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="new-pw">{t("profile.pw.new")}</Label><Input id="new-pw" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-invalid={!!nextErr} />{nextErr && <p className="text-xs text-red-400">{nextErr}</p>}</div>
          <div className="sm:col-span-2"><Button type="submit" variant="secondary" disabled={busy}>{busy && <Loader2 className="animate-spin" />}{t("profile.pw.submit")}</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}
