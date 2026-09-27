import styles from './login.module.css';
/** The shared identity panel for Sign in, Sign up and verification. */
export function AuthFrame({titleId,children}:{titleId:string;children:React.ReactNode}){
 return <section className={styles.page} aria-labelledby={titleId}><div className={styles.frame}>
  <aside className={styles.identity} aria-label="About Prodwise"><p className={styles.wordmark}>Prodwise</p><div className={styles.identityBody}><p className={styles.statement}>Product intelligence, from evidence to action.</p><ul className={styles.principles}>{['Trusted initiative state','Human decisions','AI-grounded weekly review'].map(p=><li key={p}><span className={styles.node} aria-hidden="true"/><span>{p}</span></li>)}</ul></div></aside>
  <div className={styles.entry}><div className={styles.entryContent}>{children}</div></div></div></section>;
}
