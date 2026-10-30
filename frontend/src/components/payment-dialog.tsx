"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Loader2, QrCode } from "lucide-react";

import { api, errorMessage } from "@/lib/api";
import { money } from "@/lib/format";
import type { PaymentIntent, Transaction } from "@/lib/types";
import { useLang } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Phase = "creating" | "awaiting" | "paying" | "paid" | "error";

/**
 * Simulated checkout (mock PromptPay QR).
 * 1. `createIntent` makes a PENDING order/subscription + transaction on the server
 * 2. we render a QR for the intent
 * 3. "Simulate payment" calls POST /payments/{ref}/confirm (what a bank webhook would do)
 */
export function PaymentDialog({
  open,
  onClose,
  createIntent,
  onPaid,
}: {
  open: boolean;
  onClose: () => void;
  createIntent: () => Promise<PaymentIntent>;
  onPaid: () => void;
}) {
  const { t } = useLang();
  const [phase, setPhase] = React.useState<Phase>("creating");
  const [intent, setIntent] = React.useState<PaymentIntent | null>(null);
  const [error, setError] = React.useState("");
  const started = React.useRef(false);

  React.useEffect(() => {
    if (!open) {
      started.current = false;
      return;
    }
    if (started.current) return;
    started.current = true;
    setPhase("creating");
    setIntent(null);
    setError("");
    createIntent()
      .then((i) => {
        setIntent(i);
        setPhase("awaiting");
      })
      .catch((e) => {
        setError(errorMessage(e));
        setPhase("error");
      });
  }, [open, createIntent]);

  async function pay() {
    if (!intent) return;
    setPhase("paying");
    try {
      await new Promise((r) => setTimeout(r, 900)); // feel like a bank round-trip
      const tx = await api.post<Transaction>(`/payments/${intent.reference}/confirm`);
      if (tx.status !== "succeeded") throw new Error("Payment was not completed");
      setPhase("paid");
      onPaid();
    } catch (e) {
      setError(errorMessage(e));
      setPhase("error");
    }
  }

  async function cancelAndClose() {
    if (intent && (phase === "awaiting" || phase === "error")) {
      try {
        await api.post(`/payments/${intent.reference}/cancel`);
      } catch {}
    }
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && void cancelAndClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="size-5" /> {t("pay.title")}
          </DialogTitle>
          <DialogDescription>{t("pay.demoNote")}</DialogDescription>
        </DialogHeader>

        {phase === "creating" && (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" /> {t("pay.creating")}
          </div>
        )}

        {(phase === "awaiting" || phase === "paying") && intent && (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-xl bg-white p-3">
              <QRCodeSVG value={intent.qr_payload} size={176} />
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold">{money(intent.amount)}</div>
              <div className="text-sm text-muted-foreground">{intent.description}</div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">{intent.reference}</div>
            </div>
            <Button className="w-full" size="lg" onClick={pay} disabled={phase === "paying"}>
              {phase === "paying" ? (
                <>
                  <Loader2 className="animate-spin" /> {t("pay.processing")}
                </>
              ) : (
                t("pay.simulate")
              )}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => void cancelAndClose()} disabled={phase === "paying"}>
              {t("common.cancel")}
            </Button>
          </div>
        )}

        {phase === "paid" && intent && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="size-14 text-emerald-400" />
            <div className="text-lg font-semibold">{t("pay.success")}</div>
            <div className="text-sm text-muted-foreground">
              {money(intent.amount)} · {intent.reference}
            </div>
            <Button className="w-full" onClick={onClose}>
              {t("common.done")}
            </Button>
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-col gap-3">
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-red-300">{error}</p>
            <Button variant="secondary" onClick={() => void cancelAndClose()}>
              {t("common.close")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
