import { Glyph } from "./icons";
import styles from "./connectors.module.css";

type Status = "CONNECTED" | "NEEDS_RECONNECT" | "DISCONNECTED" | "NOT_CONNECTED";
const TEXT = { CONNECTED: "Connected", NEEDS_RECONNECT: "Needs reconnect", NOT_CONNECTED: "Not connected", NOT_READY: "Not set up" } as const;

/** Connection state as glyph + text; colour only reinforces it. */
export function ConnectionPill({ ready, status, compact }: { ready: boolean; status: Status; compact?: boolean }) {
  const key = !ready ? "NOT_READY" : status === "CONNECTED" ? "CONNECTED" : status === "NEEDS_RECONNECT" ? "NEEDS_RECONNECT" : "NOT_CONNECTED";
  return <span className={styles.pill} data-state={key} data-compact={compact || undefined}>
    <Glyph name={key === "CONNECTED" ? "check" : key === "NEEDS_RECONNECT" ? "warning" : key === "NOT_READY" ? "minus" : "dot"} size={compact ? 10 : 12} />
    <span>{TEXT[key]}</span>
  </span>;
}
