"use client";
import { useLinkStatus } from "next/link";

/** Fixed-size pending mark inside a Link: shows the click registered, without shifting layout. */
export function PendingHint() {
  const { pending } = useLinkStatus();
  return <span aria-hidden="true" data-link-pending={pending || undefined} className="link-pending" />;
}
