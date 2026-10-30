"use client";

/* eslint-disable react-hooks/set-state-in-effect -- effects here intentionally sync external state (localStorage / API) into React state */

import * as React from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";

import { api, errorMessage } from "@/lib/api";
import { formatDate, money, moneyShort } from "@/lib/format";
import type { Analytics, Role, Transaction, User } from "@/lib/types";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { axisProps, CHART_COLORS, ChartCard, gridStroke, tooltipProps } from "@/components/chart-kit";
import { useLang } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AdminPage() {
  const { t } = useLang();
  const { loading, allowed } = useRequireAuth(["admin"]);
  const [days, setDays] = React.useState("30");
  const [data, setData] = React.useState<Analytics | null>(null);

  React.useEffect(() => {
    if (!allowed) return;
    setData(null);
    api.get<Analytics>(`/admin/analytics?days=${days}`).then(setData).catch((e) => toast.error(errorMessage(e)));
  }, [allowed, days]);

  if (loading) return <div className="mx-auto max-w-6xl space-y-4 px-4 py-10"><Skeleton className="h-10 w-72" /><Skeleton className="h-40" /></div>;
  if (!allowed)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">{t("admin.forbidden.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("admin.forbidden.desc")}</p>
      </div>
    );

  const k = data?.kpis;
  const daily = data?.daily.map((d) => ({ ...d, label: d.date.slice(5) })) ?? [];
  const roleData = data?.users_by_role.map((r) => ({ name: t(`role.${r.role}`), count: r.count })) ?? [];
  const cards: { label: string; value: string | null; hint?: string }[] = [
    { label: t("admin.k.mrr"), value: k ? money(k.mrr) : null, hint: t("admin.k.mrrHint") },
    { label: t("admin.k.arr"), value: k ? money(k.arr) : null, hint: t("admin.k.arrHint") },
    { label: t("admin.k.gmv"), value: k ? money(k.gmv) : null, hint: t("admin.k.window", { days }) },
    { label: t("admin.k.revenue"), value: k ? money(k.platform_revenue) : null, hint: k ? `${moneyShort(k.commission_revenue)} ${t("admin.k.fees")} + ${moneyShort(k.subscription_revenue)} ${t("admin.k.subs")}` : undefined },
    { label: t("admin.k.users"), value: k ? String(k.total_users) : null, hint: k ? t("admin.k.newUsers", { n: k.new_users }) : undefined },
    { label: t("admin.k.activeSubs"), value: k ? String(k.active_subscriptions) : null },
    { label: t("admin.k.conversion"), value: k ? `${(k.conversion_rate * 100).toFixed(1)}%` : null, hint: t("admin.k.conversionHint") },
    { label: t("admin.k.tx"), value: k ? String(k.transaction_count) : null, hint: k ? money(k.transaction_volume) : undefined },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{t("admin.eyebrow")}</span>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{t("admin.title")}</h1>
        </div>
        <div className="w-44">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger aria-label={t("admin.range")}><SelectValue /></SelectTrigger>
            <SelectContent>
              {["7", "30", "90"].map((d) => <SelectItem key={d} value={d}>{t("admin.lastDays", { days: d })}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="gap-2">
            <CardContent>
              <div className="text-sm text-muted-foreground">{c.label}</div>
              {c.value === null ? <Skeleton className="mt-2 h-8 w-28" /> : <div className="mt-1 text-2xl font-bold tracking-tight">{c.value}</div>}
              {c.hint && <div className="mt-1 text-xs text-muted-foreground">{c.hint}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      {!data ? (
        <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-80" /><Skeleton className="h-80" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <ChartCard title={t("admin.c.mrr")} description={t("admin.c.mrrDesc")}>
            <AreaChart data={daily} margin={{ left: 0, right: 8, top: 8 }}>
              <defs><linearGradient id="mrr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="label" {...axisProps} minTickGap={24} />
              <YAxis {...axisProps} width={48} tickFormatter={(v) => moneyShort(v)} />
              <Tooltip {...tooltipProps} formatter={(v) => money(Number(v))} />
              <Area type="monotone" dataKey="mrr" name="MRR" stroke="var(--chart-1)" strokeWidth={2} fill="url(#mrr)" />
            </AreaChart>
          </ChartCard>
          <ChartCard title={t("admin.c.revenue")} description={t("admin.c.revenueDesc")}>
            <BarChart data={daily} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="label" {...axisProps} minTickGap={24} />
              <YAxis {...axisProps} width={48} tickFormatter={(v) => moneyShort(v)} />
              <Tooltip {...tooltipProps} formatter={(v) => money(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="commission" name={t("admin.k.fees")} stackId="a" fill="var(--chart-2)" />
              <Bar dataKey="subscription_revenue" name={t("admin.k.subs")} stackId="a" fill="var(--chart-4)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartCard>
          <ChartCard title={t("admin.c.gmv")} description={t("admin.c.gmvDesc")}>
            <BarChart data={daily} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="label" {...axisProps} minTickGap={24} />
              <YAxis {...axisProps} width={48} tickFormatter={(v) => moneyShort(v)} />
              <Tooltip {...tooltipProps} formatter={(v) => money(Number(v))} />
              <Bar dataKey="gmv" name="GMV" fill="var(--chart-3)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartCard>
          <ChartCard title={t("admin.c.signups")} description={t("admin.c.signupsDesc")}>
            <BarChart data={daily} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="label" {...axisProps} minTickGap={24} />
              <YAxis {...axisProps} width={32} allowDecimals={false} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="signups" name={t("admin.c.signups")} fill="var(--chart-5)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartCard>
          <ChartCard title={t("admin.c.byTier")} description={t("admin.c.byTierDesc")}>
            <BarChart data={roleData} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} width={32} allowDecimals={false} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="count" name={t("admin.k.users")} radius={[3, 3, 0, 0]}>
                {roleData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ChartCard>
          <ChartCard title={t("admin.c.planMix")} description={t("admin.c.planMixDesc")}>
            <PieChart>
              <Tooltip {...tooltipProps} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Pie data={data.plan_mix} dataKey="count" nameKey="plan" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
                {data.plan_mix.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
            </PieChart>
          </ChartCard>
        </div>
      )}

      {data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">{t("admin.top.passes")}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>{t("ws.col.pass")}</TableHead><TableHead className="text-right">{t("admin.units")}</TableHead><TableHead className="text-right">{t("admin.revenue")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.top_gamepasses.map((p) => (
                    <TableRow key={p.id}><TableCell><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.game}</div></TableCell><TableCell className="text-right">{p.units}</TableCell><TableCell className="text-right">{money(p.revenue)}</TableCell></TableRow>
                  ))}
                  {data.top_gamepasses.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">{t("admin.noData")}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">{t("admin.top.sellers")}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>{t("admin.seller")}</TableHead><TableHead className="text-right">{t("admin.units")}</TableHead><TableHead className="text-right">{t("admin.revenue")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.top_sellers.map((s) => (
                    <TableRow key={s.id}><TableCell className="font-medium">{s.seller}</TableCell><TableCell className="text-right">{s.units}</TableCell><TableCell className="text-right">{money(s.revenue)}</TableCell></TableRow>
                  ))}
                  {data.top_sellers.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">{t("admin.noData")}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      <UserManagement />
      <RecentTransactions />
    </div>
  );
}

function UserManagement() {
  const { t, lang } = useLang();
  const [q, setQ] = React.useState("");
  const [role, setRole] = React.useState("all");
  const [page, setPage] = React.useState(0);
  const [res, setRes] = React.useState<{ total: number; items: User[] } | null>(null);
  const LIMIT = 8;

  const load = React.useCallback(() => {
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(page * LIMIT) });
    if (q.trim()) params.set("q", q.trim());
    if (role !== "all") params.set("role", role);
    api.get<{ total: number; items: User[] }>(`/admin/users?${params}`).then(setRes).catch((e) => toast.error(errorMessage(e)));
  }, [q, role, page]);
  React.useEffect(() => {
    const id = setTimeout(load, 250); // debounce search
    return () => clearTimeout(id);
  }, [load]);

  async function patch(u: User, body: { role?: Role; is_active?: boolean }) {
    try {
      await api.patch(`/admin/users/${u.id}`, body);
      toast.success(t("admin.users.updated"));
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
        <CardTitle>{t("admin.users.title")}</CardTitle>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input className="w-56 pl-9" placeholder={t("admin.users.search")} aria-label={t("admin.users.search")} value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          </div>
          <div className="w-32">
            <Select value={role} onValueChange={(v) => { setRole(v); setPage(0); }}>
              <SelectTrigger aria-label="Role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.users.allRoles")}</SelectItem>
                {(["free", "pro", "admin"] as const).map((r) => <SelectItem key={r} value={r}>{t(`role.${r}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {res === null ? <Skeleton className="h-48" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>{t("admin.users.user")}</TableHead><TableHead>{t("profile.plan.role")}</TableHead><TableHead>{t("ws.col.status")}</TableHead><TableHead>{t("admin.users.joined")}</TableHead><TableHead className="text-right">{t("ws.col.actions")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {res.items.map((u) => (
                <TableRow key={u.id}>
                  <TableCell><div className="font-medium">{u.display_name}</div><div className="text-xs text-muted-foreground">{u.email}</div></TableCell>
                  <TableCell><Badge variant={u.role === "admin" ? "warning" : u.role === "pro" ? "success" : "secondary"}>{t(`role.${u.role}`)}</Badge></TableCell>
                  <TableCell>{u.is_active ? <Badge variant="success">{t("ws.active")}</Badge> : <Badge variant="destructive">{t("admin.users.disabled")}</Badge>}</TableCell>
                  <TableCell>{formatDate(u.created_at, lang)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {u.role === "pro" && <Button size="sm" variant="outline" onClick={() => patch(u, { role: "free" })}>{t("admin.users.demote")}</Button>}
                      {u.role === "free" && <Button size="sm" variant="outline" onClick={() => patch(u, { role: "admin" })}>{t("admin.users.makeAdmin")}</Button>}
                      <Button size="sm" variant={u.is_active ? "destructive" : "secondary"} onClick={() => patch(u, { is_active: !u.is_active })}>
                        {u.is_active ? t("admin.users.disable") : t("admin.users.enable")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {res.items.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">{t("admin.noData")}</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
        {res && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{t("admin.users.count", { n: res.total })}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>{t("common.prev")}</Button>
              <Button size="sm" variant="outline" disabled={(page + 1) * LIMIT >= res.total} onClick={() => setPage(page + 1)}>{t("common.next")}</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentTransactions() {
  const { t, lang } = useLang();
  const [txs, setTxs] = React.useState<Transaction[] | null>(null);
  React.useEffect(() => { api.get<Transaction[]>("/admin/transactions?limit=10").then(setTxs).catch(() => setTxs([])); }, []);
  const variant = { succeeded: "success", pending: "warning", failed: "destructive" } as const;
  return (
    <Card>
      <CardHeader><CardTitle>{t("admin.tx.title")}</CardTitle></CardHeader>
      <CardContent>
        {txs === null ? <Skeleton className="h-40" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>{t("profile.col.ref")}</TableHead><TableHead>{t("profile.col.type")}</TableHead><TableHead>{t("profile.col.total")}</TableHead><TableHead>{t("ws.col.status")}</TableHead><TableHead>{t("profile.col.date")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {txs.map((x) => (
                <TableRow key={x.id}>
                  <TableCell className="font-mono text-xs">{x.reference}</TableCell>
                  <TableCell>{t(`kind.${x.kind}`)}</TableCell>
                  <TableCell>{money(x.amount)}</TableCell>
                  <TableCell><Badge variant={variant[x.status]}>{t(`status.${x.status}`)}</Badge></TableCell>
                  <TableCell>{formatDate(x.paid_at ?? x.created_at, lang)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
