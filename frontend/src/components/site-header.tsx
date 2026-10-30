"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, Menu, ShieldCheck, ShoppingCart, Store, User as UserIcon, Zap } from "lucide-react";

import { useAuth, useCart, useLang } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5 font-bold tracking-tight">
      <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-gray-100 to-gray-400 text-sm font-black text-black">P</span>
      <span className={compact ? "hidden whitespace-nowrap sm:inline" : "whitespace-nowrap"}>Prompt Market</span>
    </span>
  );
}

export function SiteHeader() {
  const { t, lang, toggle } = useLang();
  const { user, loading, logout } = useAuth();
  const { count } = useCart();
  const router = useRouter();

  const nav = [
    { href: "/market", label: t("nav.shop") },
    { href: "/#features", label: t("nav.features") },
    { href: "/#how", label: t("nav.how") },
    { href: "/pricing", label: t("nav.pricing") },
    { href: "/#faq", label: t("nav.faq") },
  ];

  async function onLogout() {
    await logout();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
                <Menu />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {nav.map((n) => (
                <DropdownMenuItem key={n.href} asChild>
                  <Link href={n.href}>{n.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/" aria-label="Prompt Market home">
            <BrandMark compact />
          </Link>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggle} aria-label="Switch language" className="font-semibold">
            {lang === "en" ? "EN / TH" : "TH / EN"}
          </Button>
          <Button variant="ghost" size="sm" asChild className="relative">
            <Link href="/cart" aria-label={t("nav.cart")}>
              <ShoppingCart />
              <span className="hidden sm:inline">{t("nav.cart")}</span>
              <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground" suppressHydrationWarning>
                {count}
              </span>
            </Link>
          </Button>

          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded-md bg-accent" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="max-w-40">
                  <UserIcon />
                  <span className="truncate">{user.display_name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="flex items-center justify-between gap-3">
                  <span className="truncate">{user.email}</span>
                  <Badge variant={user.role === "admin" ? "warning" : user.role === "pro" ? "success" : "secondary"}>{user.role.toUpperCase()}</Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile"><UserIcon /> {t("nav.profile")}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/workspace"><Store /> {t("nav.workspace")}</Link>
                </DropdownMenuItem>
                {user.role === "admin" && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin"><ShieldCheck /> {t("nav.admin")}</Link>
                  </DropdownMenuItem>
                )}
                {user.role === "free" && (
                  <DropdownMenuItem asChild>
                    <Link href="/pricing"><Zap /> {t("nav.upgrade")}</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onLogout}>
                  <LogOut /> {t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" asChild>
              <Link href="/login"><LayoutDashboard className="hidden" />{t("nav.login")}</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
