import Link from 'next/link';
import { BrandMark } from '@/components/primitives/BrandMark';
import styles from './login.module.css';

const PRINCIPLES = [
  { title: 'Evidence before truth', text: 'Sources stay evidence until a person confirms what they mean.' },
  { title: 'Human decisions', text: 'Differences are surfaced and decided by people, with a record of why.' },
  { title: 'One weekly picture', text: 'The review reads the same confirmed records as every screen.' },
];

/** Faint lifecycle ring bleeding off the panel: decoration, never a hero graphic. */
function PanelArc() {
  const r = 46, gap = 5, step = 45;
  const pt = (deg: number) => [50 + r * Math.cos((deg * Math.PI) / 180), 50 + r * Math.sin((deg * Math.PI) / 180)].map(n => n.toFixed(2)).join(' ');
  return <svg className={styles.panelArc} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    {Array.from({ length: 8 }, (_, i) => { const a = -90 + i * step + gap / 2; return <path key={i} d={`M ${pt(a)} A ${r} ${r} 0 0 1 ${pt(a + step - gap)}`} fill="none" strokeWidth="1.6" className={i === 1 ? styles.arcCurrent : undefined} />; })}
    <circle cx="50" cy="50" r="30" fill="none" strokeWidth="0.4" strokeDasharray="1 2.2" />
  </svg>;
}

/** The shared entry frame for Sign in, Sign up and verification. */
export function AuthFrame({ titleId, children }: { titleId: string; children: React.ReactNode }) {
  return <section className={styles.page} aria-labelledby={titleId}>
    <aside className={styles.identity} aria-label="About Prodwise">
      <p className={styles.wordmark}><BrandMark size={28} /><span>Prodwise</span></p>
      <div className={styles.identityBody}>
        <p className={styles.statement}>Product intelligence, from evidence to action.</p>
        <ul className={styles.principles}>
          {PRINCIPLES.map(p => <li key={p.title}><span className={styles.node} aria-hidden="true" /><span><strong>{p.title}</strong>{p.text}</span></li>)}
        </ul>
      </div>
      <p className={styles.panelFoot}>For product teams in regulated, multi-team delivery.</p>
      <PanelArc />
    </aside>
    <div className={styles.entry}>
      <div className={styles.entryContent}>{children}<p className={styles.legalLink}><Link href="/privacy">Privacy policy</Link></p></div>
    </div>
  </section>;
}
