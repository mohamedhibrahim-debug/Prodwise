import { isDemoWriteEnabled } from "@/lib/env";
import type { WorkspaceAccess } from "@/lib/delivery/types";
import styles from "./delivery.module.css";
export function WriteNotice({ctx}:{ctx:WorkspaceAccess}) {
  if (ctx.role === "Viewer") return <p className={styles.notice}>Viewer access · You can read delivery facts and reviews. Workspace Members maintain their PM sections; an Admin or Product Lead finalizes the portfolio.</p>;
  if (!isDemoWriteEnabled) return <p className={styles.notice}>Changes are disabled in this environment. Saved delivery facts and reviews remain available to read; your membership role has not changed.</p>;
  return null;
}
