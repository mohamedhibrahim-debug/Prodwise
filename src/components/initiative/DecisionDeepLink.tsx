"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function DecisionDeepLink() {
  const item = useSearchParams().get("item");
  useEffect(() => {
    if (!item) return;
    const element = document.getElementById(`item-${item}`);
    if (!element) return;
    requestAnimationFrame(() => {
      element.scrollIntoView({ block: "start", behavior: "smooth" });
      element.focus({ preventScroll: true });
    });
  }, [item]);
  return null;
}
