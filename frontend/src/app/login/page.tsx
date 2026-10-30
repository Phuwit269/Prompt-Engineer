"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { errorMessage } from "@/lib/api";
import { useAuth, useLang } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEMO = [
  { label: "Admin", email: "admin@promptmarket.dev", password: "Admin123!" },
  { label: "Pro seller", email: "seller@promptmarket.dev", password: "Seller123!" },
  { label: "Free buyer", email: "buyer@promptmarket.dev", password: "Buyer123!" },
];

function AuthForms() {
  const { t } = useLang();
  const { user, login, register } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const [tab, setTab] = React.useState(params.get("tab") === "signup" ? "signup" : "login");
  const [busy, setBusy] = React.useState(false);

  const [form, setForm] = React.useState({ name: "", email: "", password: "" });
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [serverError, setServerError] = React.useState("");

  const errors = {
    name: tab === "signup" && form.name.trim().length < 2 ? t("auth.err.name") : "",
    email: !EMAIL_RE.test(form.email) ? t("auth.err.email") : "",
    password: form.password.length < (tab === "signup" ? 8 : 1) ? t(tab === "signup" ? "auth.err.passwordShort" : "auth.err.passwordEmpty") : "",
  };
  const show = (k: keyof typeof errors) => (touched[k] ? errors[k] : "");

  React.useEffect(() => {
    if (user) router.replace(next && next.startsWith("/") ? next : user.role === "admin" ? "/admin" : "/market");
  }, [user, next, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true });
    setServerError("");
    if (errors.email || errors.password || errors.name) return;
    setBusy(true);
    try {
      const u = tab === "signup" ? await register(form.email, form.password, form.name.trim()) : await login(form.email, form.password);
      toast.success(t(tab === "signup" ? "auth.registered" : "auth.loggedIn", { name: u.display_name }));
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const field = (id: "name" | "email" | "password", label: string, type = "text", autoComplete?: string) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={form[id]}
        aria-invalid={!!show(id)}
        aria-describedby={show(id) ? `${id}-error` : undefined}
        onChange={(e) => setForm({ ...form, [id]: e.target.value })}
        onBlur={() => setTouched((p) => ({ ...p, [id]: true }))}
      />
      {show(id) && (
        <p id={`${id}-error`} className="text-xs text-red-400">
          {show(id)}
        </p>
      )}
    </div>
  );

  return (
    <div className="mx-auto grid w-full max-w-md gap-4 px-4 py-14">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t("auth.title")}</CardTitle>
          <CardDescription>{t("auth.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v);
              setTouched({});
              setServerError("");
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">{t("auth.login")}</TabsTrigger>
              <TabsTrigger value="signup">{t("auth.signup")}</TabsTrigger>
            </TabsList>
            {["login", "signup"].map((v) => (
              <TabsContent key={v} value={v}>
                <form onSubmit={submit} noValidate className="space-y-4">
                  {v === "signup" && field("name", t("auth.name"), "text", "name")}
                  {field("email", t("auth.email"), "email", "email")}
                  {field("password", t("auth.password"), "password", v === "signup" ? "new-password" : "current-password")}
                  {serverError && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-red-300">{serverError}</p>}
                  <Button type="submit" className="w-full" size="lg" disabled={busy}>
                    {busy && <Loader2 className="animate-spin" />}
                    {v === "signup" ? t("auth.createAccount") : t("auth.loginCta")}
                  </Button>
                </form>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="space-y-3">
          <div className="text-sm font-medium">{t("auth.demo")}</div>
          <div className="flex flex-wrap gap-2">
            {DEMO.map((d) => (
              <Button
                key={d.email}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setTab("login");
                  setForm({ name: "", email: d.email, password: d.password });
                  setTouched({});
                  setServerError("");
                }}
              >
                {d.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("auth.demoNote")}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthForms />
    </Suspense>
  );
}
