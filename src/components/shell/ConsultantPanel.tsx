"use client";

import { useEffect, useState } from "react";
import styles from "./ConsultantPanel.module.css";

/**
 * AI CONSULTANT — reserved affordance only.
 *
 * Phase 1 implements no AI functionality. This exists so the eventual side
 * panel has a home in the layout, and it says plainly that it does nothing yet
 * rather than pretending otherwise. It is collapsed by default and lives at the
 * screen edge: chat must never become the main product experience.
 */
export function ConsultantPanel() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(true)}
      >
        AI Consultant
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className={styles.scrim}
        aria-label="Close AI Consultant"
        onClick={() => setOpen(false)}
      />
      <aside
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="AI Consultant"
      >
        <div className={styles.panelHead}>
          <div>
            <h2 className={styles.panelTitle}>AI Consultant</h2>
            <p className={styles.panelSub}>Secondary panel · not yet available</p>
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className={styles.panelBody}>
          <p className={styles.notice}>
            The AI Consultant is not implemented in Phase 1.
          </p>
          <p className={styles.detail}>
            Prodwise is a structured workspace, not a chat product. Reasoning is
            intended to surface in the workspace itself — in Current State,
            Product Memory, Review, Evidence, Readiness and Next Best Action.
            This panel is reserved for follow-up questions about conclusions the
            workspace has already made, and stays secondary to it.
          </p>

          <div className={styles.list}>
            <p className={styles.detail} style={{ marginTop: 0 }}>
              When implemented, it will be able to answer questions such as:
            </p>
            {[
              "Why does the system believe Finance is at risk?",
              "What evidence supports the repayment calculation conflict?",
              "What changed on this initiative in the last two weeks?",
            ].map((q) => (
              <div key={q} className={styles.listItem}>
                <span className={styles.bullet} aria-hidden="true">
                  —
                </span>
                <span>{q}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
