"use client";

import Link from "next/link";

import { CartPanel } from "@/components/cart-panel";
import { useLang } from "@/components/providers";
import { Button } from "@/components/ui/button";

export default function CartPage() {
  const { t } = useLang();
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">{t("cart.pageTitle")}</h1>
      <div className="mt-6">
        <CartPanel />
      </div>
      <Button variant="ghost" className="mt-4" asChild>
        <Link href="/market">{t("cart.continue")}</Link>
      </Button>
    </div>
  );
}
