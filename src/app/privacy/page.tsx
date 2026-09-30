import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Privacy policy" };

const CONTACT = "mohamedhassanpe@outlook.com";

/** Public page: the proxy lets it through without a session, and it reads no workspace data. */
export default function Privacy() {
  return <main className={styles.page} aria-labelledby="privacy-title">
    <p className={styles.label}>Prodwise</p>
    <h1 id="privacy-title" className={styles.title}>Privacy policy</h1>
    <p className={styles.meta}>Last updated 30 September 2026. This describes the product as it works today.</p>

    <section className={styles.section}>
      <h2>What Prodwise is</h2>
      <p>Prodwise is a product-management workspace. Teams record initiatives, the evidence behind them, the decisions they make and their delivery dates. Each person sees only the organizations and workspaces they belong to.</p>
    </section>

    <section className={styles.section}>
      <h2>What we store</h2>
      <ul>
        <li><strong>Your account:</strong> your name, work email, the organizations and workspaces you belong to and your role in them.</li>
        <li><strong>What you record:</strong> initiatives, evidence, knowledge, decisions, delivery facts, reviews and comments, each with who recorded it and when.</li>
        <li><strong>Evidence from connected tools:</strong> only the items a person searches for and chooses to add. Stored evidence can include the item’s title, text, link, dates and the names or account identifiers of the people it mentions.</li>
        <li><strong>Connection tokens:</strong> the access tokens a tool issues when you connect it, encrypted (AES-256-GCM) before they are stored.</li>
      </ul>
    </section>

    <section className={styles.section}>
      <h2>Connected tools</h2>
      <p>Every connection is read-only and is made by you, with your own account on that tool. Prodwise can only see what your account there can see.</p>
      <ul>
        <li><strong>Jira:</strong> reads the issues you select, including the names of people on them. Prodwise never changes anything in Jira.</li>
        <li><strong>Google Drive:</strong> reads the files you select, as text.</li>
        <li><strong>Gmail:</strong> reads only the threads you search for and select. Attachment names are listed; attachments are never opened.</li>
        <li><strong>Figma:</strong> reads the files and comments you link.</li>
      </ul>
      <p>Nothing imported becomes a confirmed record until a person confirms it. You can disconnect a tool at any time from your account’s Connections page.</p>
    </section>

    <section className={styles.section}>
      <h2>AI processing</h2>
      <p>Some features draft wording or answer questions using Anthropic’s Claude API. For those requests, the relevant records and evidence excerpts from your workspace are sent to Anthropic to produce the draft. Drafts are labelled, and nothing an AI drafts becomes a confirmed record without a person.</p>
    </section>

    <section className={styles.section}>
      <h2>Who processes the data</h2>
      <ul>
        <li><strong>Vercel</strong> hosts the application.</li>
        <li><strong>Supabase</strong> hosts the database.</li>
        <li><strong>Anthropic</strong> processes AI requests, as described above.</li>
      </ul>
      <p>We do not sell personal data, use it for advertising, or share it with anyone else. Data in one organization is not visible to another.</p>
    </section>

    <section className={styles.section}>
      <h2>Keeping and deleting data</h2>
      <p>Records are kept while your organization uses Prodwise, because the product keeps a history of what changed and who changed it. To access, correct or delete personal data, or to have an organization’s data removed, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
    </section>

    <section className={styles.section}>
      <h2>Contact</h2>
      <p>Questions about privacy or support: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
    </section>
  </main>;
}
