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

const toothCount = 40;
const toothDepth = 4;
const toothPoints = Array.from({ length: toothCount * 2 }, (_, index) => {
  const x = 100 - ((index + 1) * 100) / (toothCount * 2);
  const y = index % 2 === 0 ? "100%" : `calc(100% - ${toothDepth}px)`;
  return `${x}% ${y}`;
}).join(", ");
const receiptClipPath = `polygon(0 0, 100% 0, 100% calc(100% - ${toothDepth}px), ${toothPoints})`;

const printingTransformKeyframes = [
  "translateY(calc(-100% + 2px))",
  "translateY(-91%)",
  "translateY(-91%)",
  "translateY(-81%)",
  "translateY(-81%)",
  "translateY(-70%)",
  "translateY(-70%)",
  "translateY(-58%)",
  "translateY(-58%)",
  "translateY(-45%)",
  "translateY(-45%)",
  "translateY(-32%)",
  "translateY(-32%)",
  "translateY(-20%)",
  "translateY(-20%)",
  "translateY(-10%)",
  "translateY(-10%)",
  "translateY(-3%)",
  "translateY(-3%)",
  "translateY(0%)",
];

const printingKeyframeTimes = [
  0, 0.075, 0.105, 0.18, 0.21, 0.285, 0.315, 0.39, 0.42, 0.495, 0.525, 0.6, 0.63, 0.705, 0.735, 0.81,
  0.84, 0.915, 0.945, 1,
];

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
    let t1 = 0;
    let t2 = 0;
    // defer stage kickoff so open/reduce props don't sync-set in the effect body
    const start = window.setTimeout(() => {
      if (reduce) {
        setStage("complete");
        return;
      }
      setStage("processing");
      t1 = window.setTimeout(() => setStage("printing"), 700);
      t2 = window.setTimeout(() => setStage("complete"), 700 + 1750);
    }, 0);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open, reduce, data.sessionRef, data.productLabel]);

  const statusLabel =
    stage === "processing"
      ? "Zahlung wird bestätigt …"
      : stage === "printing"
        ? "Beleg wird gedruckt …"
        : "Zahlung bestätigt";

  const paperVisible = stage !== "processing";

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
          <section className={styles.machine} aria-labelledby="receipt-status" data-stage={stage}>
            {data.preview ? <p className={styles.previewBadge}>Admin-Preview · keine echte Zahlung</p> : null}
            <div className={styles.screen}>
              <p id="receipt-status" className={styles.status} aria-live="polite">
                {statusLabel}
              </p>
            </div>
            <div className={styles.output} aria-hidden={!paperVisible}>
              <motion.article
                className={styles.paper}
                style={{ clipPath: receiptClipPath }}
                initial={false}
                animate={{
                  opacity: paperVisible ? 1 : 0,
                  transform:
                    stage === "printing" && !reduce
                      ? printingTransformKeyframes
                      : paperVisible || reduce
                        ? "translateY(0%)"
                        : "translateY(calc(-100% + 2px))",
                }}
                transition={{
                  opacity: { duration: reduce ? 0 : 0.16 },
                  transform: {
                    duration: reduce ? 0 : stage === "printing" ? 1.75 : 0.18,
                    ease: stage === "printing" && !reduce ? "linear" : [0.65, 0, 0.35, 1],
                    times: stage === "printing" && !reduce ? printingKeyframeTimes : undefined,
                  },
                }}
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
