"use client";
import "@/styles/tokens.css";
import "@/styles/global.css";
import styles from "./global-error.module.css";

/** Last-resort boundary when the application shell itself fails to render. No technical detail is shown. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <html lang="en"><body className={styles.body}>
    <main className={styles.main}>
      <h1>Prodwise could not load</h1>
      <p>Something went wrong while opening the application. Nothing you saved has changed.</p>
      <p>Try again in a moment. If it keeps happening, sign in again.</p>
      <div className={styles.actions}><button type="button" onClick={() => retry()} className={styles.retry}>Try again</button><a href="/login">Sign in again</a></div>
      {error.digest ? <p className={styles.digest}>Reference {error.digest}</p> : null}
    </main>
  </body></html>;
}
