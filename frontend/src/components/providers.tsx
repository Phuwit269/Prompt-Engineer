"use client";

/* eslint-disable react-hooks/set-state-in-effect -- effects here intentionally sync external state (localStorage / API) into React state */

import * as React from "react";

import { api, ApiError } from "@/lib/api";
import { dictionary, type Lang } from "@/lib/i18n";
import type { Gamepass, User } from "@/lib/types";
import { Toaster } from "@/components/ui/sonner";

/* ------------------------------ i18n ------------------------------ */
interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}
const LangContext = React.createContext<LangCtx | null>(null);

export function useLang() {
  const ctx = React.useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside <Providers>");
  return ctx;
}

/* ------------------------------ auth ------------------------------ */
interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, display_name: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<User | null>;
  setUser: (u: User | null) => void;
}
const AuthContext = React.createContext<AuthCtx | null>(null);

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <Providers>");
  return ctx;
}

/* ------------------------------ cart ------------------------------ */
export interface CartItem {
  id: number; // gamepass id
  qty: number;
  name_en: string;
  name_th: string;
  game_en: string;
  game_th: string;
  seller: string;
  price: string; // display only — the server always re-prices at checkout
}
interface CartCtx {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (p: Gamepass) => void;
  setQty: (id: number, qty: number) => void;
  remove: (id: number) => void;
  clear: () => void;
}
const CartContext = React.createContext<CartCtx | null>(null);

export function useCart() {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <Providers>");
  return ctx;
}

const CART_KEY = "pm-cart";
const LANG_KEY = "pm-lang";

export function Providers({ children }: { children: React.ReactNode }) {
  /* lang */
  const [lang, setLangState] = React.useState<Lang>("en");
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === "th" || saved === "en") setLangState(saved);
    } catch {}
  }, []);
  React.useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = React.useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {}
  }, []);
  const t = React.useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = dictionary[lang][key] ?? dictionary.en[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
      return s;
    },
    [lang],
  );
  const langValue = React.useMemo(() => ({ lang, setLang, toggle: () => setLang(lang === "en" ? "th" : "en"), t }), [lang, setLang, t]);

  /* auth */
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const refresh = React.useCallback(async () => {
    try {
      const u = await api.get<User>("/auth/me");
      setUser(u);
      return u;
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) console.error(e);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    void refresh();
  }, [refresh]);
  const authValue = React.useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      setUser,
      refresh,
      login: async (email, password) => {
        const res = await api.post<{ user: User }>("/auth/login", { email, password });
        setUser(res.user);
        return res.user;
      },
      register: async (email, password, display_name) => {
        const res = await api.post<{ user: User }>("/auth/register", { email, password, display_name });
        setUser(res.user);
        return res.user;
      },
      logout: async () => {
        await api.post("/auth/logout");
        setUser(null);
      },
    }),
    [user, loading, refresh],
  );

  /* cart */
  const [items, setItems] = React.useState<CartItem[]>([]);
  const [cartReady, setCartReady] = React.useState(false);
  React.useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      if (Array.isArray(raw)) setItems(raw);
    } catch {}
    setCartReady(true);
  }, []);
  React.useEffect(() => {
    if (!cartReady) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {}
  }, [items, cartReady]);
  const cartValue = React.useMemo<CartCtx>(
    () => ({
      items,
      count: items.reduce((s, i) => s + i.qty, 0),
      subtotal: items.reduce((s, i) => s + Number(i.price) * i.qty, 0),
      add: (p) =>
        setItems((prev) => {
          const found = prev.find((i) => i.id === p.id);
          if (found) return prev.map((i) => (i.id === p.id ? { ...i, qty: Math.min(i.qty + 1, 20) } : i));
          return [
            ...prev,
            { id: p.id, qty: 1, name_en: p.name_en, name_th: p.name_th, game_en: p.game_name_en, game_th: p.game_name_th, seller: p.seller_name, price: p.price },
          ];
        }),
      setQty: (id, qty) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, qty: Math.max(1, Math.min(20, qty)) } : i))),
      remove: (id) => setItems((prev) => prev.filter((i) => i.id !== id)),
      clear: () => setItems([]),
    }),
    [items],
  );

  return (
    <LangContext.Provider value={langValue}>
      <AuthContext.Provider value={authValue}>
        <CartContext.Provider value={cartValue}>
          {children}
          <Toaster position="top-right" richColors />
        </CartContext.Provider>
      </AuthContext.Provider>
    </LangContext.Provider>
  );
}
