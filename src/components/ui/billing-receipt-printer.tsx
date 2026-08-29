"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import styles from "./billing-receipt-printer.module.css";

export type BillingReceiptData = {
  kind: "subscription" | "token_pack";
  productLabel: string;
  plan?: string | null;
  tokensGranted?: number | null;
  remainingTokens?: number | null;
  amountLabel?: string | null;
  sessionRef?: string | null;
  dateLabel: string;
  preview?: boolean;
};

type Stage = "processing" | "printing" | "complete";

export function BillingReceiptPrinter({
  data,
  open,
  onClose,
}: {
  data: BillingReceiptData;
  open: boolean;
  onClose?: () => void;
}) {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<Stage>(reduce ? "complete" : "processing");

  useEffect(() => {
    if (!open) return;
    if (reduce) {
      setStage("complete");
      return;
    }
    setStage("processing");
    const t1 = window.setTimeout(() => setStage("printing"), 700);
    const t2 = window.setTimeout(() => setStage("complete"), 700 + 1750);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open, reduce, data.sessionRef, data.productLabel]);

  const statusLabel =
    stage === "processing" ? "Zahlung wird bestätigt …" : stage === "printing" ? "Beleg wird gedruckt …" : "Zahlung bestätigt";

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={styles.overlay}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.18 }}
          role="dialog"
          aria-modal="true"
          aria-label="Zahlungsbeleg"
        >
          <div className={styles.scrim} onClick={onClose} aria-hidden />
          <section className={styles.machine} aria-labelledby="receipt-status">
            {data.preview ? <p className={styles.previewBadge}>Admin-Preview · keine echte Zahlung</p> : null}
            <div className={styles.screen}>
              <p id="receipt-status" className={styles.status} aria-live="polite">
                {statusLabel}
              </p>
            </div>
            <div className={styles.output} aria-hidden={stage === "processing"}>
              <motion.article
                className={styles.paper}
                initial={reduce ? false : { y: -120, opacity: 0 }}
                animate={
                  stage === "processing"
                    ? { y: -120, opacity: 0 }
                    : reduce
                      ? { y: 0, opacity: 1 }
                      : { y: 0, opacity: 1 }
                }
                transition={
                  reduce
                    ? { duration: 0 }
                    : stage === "printing"
                      ? { duration: 1.75, ease: [0.65, 0, 0.35, 1] }
                      : { duration: 0.18 }
                }
              >
                <p className={styles.paperBrand}>BrewAI</p>
                <p className={styles.paperMeta}>{data.dateLabel}</p>
                <h2 className={styles.paperTitle}>{data.productLabel}</h2>
                {data.amountLabel ? <p className={styles.paperLine}>Betrag · {data.amountLabel}</p> : null}
                {data.plan ? <p className={styles.paperLine}>Plan · {data.plan}</p> : null}
                {typeof data.tokensGranted === "number" ? (
                  <p className={styles.paperLine}>Tokens · +{data.tokensGranted.toLocaleString("de-DE")}</p>
                ) : null}
                {typeof data.remainingTokens === "number" ? (
                  <p className={styles.paperLine}>
                    Guthaben · {data.remainingTokens.toLocaleString("de-DE")} Tokens
                  </p>
                ) : null}
                {data.sessionRef ? <p className={styles.paperRef}>Ref · …{data.sessionRef}</p> : null}
                <p className={styles.paperFoot}>Status · bestätigt</p>
              </motion.article>
            </div>
            {stage === "complete" && onClose ? (
              <button type="button" className={styles.close} onClick={onClose}>
                Weiter
              </button>
            ) : null}
          </section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
