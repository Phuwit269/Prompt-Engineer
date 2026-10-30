"use client";

import Link from "next/link";

import { useLang } from "@/components/providers";
import { BrandMark } from "@/components/site-header";

export function SiteFooter() {
  const { t } = useLang();
  return (
    <footer className="mt-24 border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <BrandMark />
          <p className="max-w-sm text-sm text-muted-foreground">{t("footer.tagline")}</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link href="/market" className="hover:text-foreground">{t("nav.shop")}</Link>
          <Link href="/pricing" className="hover:text-foreground">{t("nav.pricing")}</Link>
          <Link href="/workspace" className="hover:text-foreground">{t("nav.workspace")}</Link>
          <Link href="/#faq" className="hover:text-foreground">{t("nav.faq")}</Link>
        </nav>
      </div>
      <div className="border-t py-4 text-center text-xs text-muted-foreground">© 2026 Prompt Market · {t("footer.note")}</div>
    </footer>
  );
}
