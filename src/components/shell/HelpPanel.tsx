'use client';
import { useEffect, useRef } from 'react';
import { usePathname,useRouter } from 'next/navigation';
import { RESTART_ORIENTATION,orientationStorageKey } from './FirstRunOrientation';
import type {ShellIdentity} from './ShellIdentity';
import styles from './HelpPanel.module.css';
export const OPEN_HELP='prodwise:help';
export function HelpPanel({identity}:{identity:ShellIdentity}){const dialog=useRef<HTMLDialogElement>(null);const origin=useRef<HTMLElement|null>(null);const path=usePathname();const router=useRouter();
 useEffect(()=>{function open(){origin.current=document.activeElement as HTMLElement;dialog.current?.showModal();}window.addEventListener(OPEN_HELP,open);return()=>window.removeEventListener(OPEN_HELP,open);},[]);
 function close(){dialog.current?.close();origin.current?.focus();}
 const about=helpFor(path);
 return <dialog ref={dialog} className={styles.dialog} aria-label="Prodwise Help" onCancel={()=>origin.current?.focus()}><header><h2>Prodwise Help</h2><button onClick={close} aria-label="Close Help">Close ×</button></header><section><h3>About this page</h3><p>{about}</p></section><section><h3>How Prodwise works</h3><p>Sources you add or import are evidence, not truth. Prodwise can propose facts from them; a person confirms what becomes Knowledge, a decision or a delivery date. Home, the Roadmap, Notifications and the Weekly Review all read those same confirmed records.</p><p>Unknown dates and unrecorded facts stay unknown. Checks compare recorded values; they do not assess release readiness or business impact.</p></section><section><h3>Keyboard shortcuts</h3><dl><dt>Ctrl / ⌘ K</dt><dd>Search</dd><dt>Alt 1–4</dt><dd>Inside an initiative: Brief, Decisions, Knowledge, Sources</dd><dt>Escape</dt><dd>Close a dialog</dd></dl></section><button onClick={()=>{try{localStorage.removeItem(orientationStorageKey(identity));}catch{}window.dispatchEvent(new Event(RESTART_ORIENTATION));close();if(path!=='/')router.push('/');}}>Restart Home orientation</button></dialog>;
}

/** Plain guidance for the page the person is on. */
function helpFor(path:string):string{
 const tab=/^\/initiatives\/[^/]+(?:\/([^/?#]+))?/.exec(path)?.[1]??null, inInitiative=/^\/initiatives\/(?!new\b)[^/]+/.test(path);
 if(inInitiative){
  const byTab:Record<string,string>={
   decisions:'Decisions lists places where confirmed Knowledge entries record different values for the same thing. Compare the sources, then record a decision, defer it, or dismiss it with a reason. Nothing is decided for you.',
   knowledge:'Knowledge holds what is recorded as true, with its scope, sources and verification. Entries you add or accept start as awaiting verification; replaced entries stay in history.',
   sources:'Sources holds the material behind Knowledge: documents, email, Jira work, designs and meeting notes. Import from connected accounts or add a reference; refreshing a connected source saves a new snapshot only if it changed.',
   evidence:'Saved evidence and meeting notes. Open one to read it and review what was proposed from it; accept, edit or reject each proposal. Only accepted items change the initiative.',
   actions:'Commitments are promises people made — from reviews, meetings and decisions — with an owner and a due date. They are not delivery tickets.',
   context:'Risks & questions tracks open risks (recorded in Knowledge first) and questions that need an answer by a date. Answering with a Knowledge entry keeps the answer traceable.',
   history:'History shows how this initiative changed and who changed it, newest first. It is built from the records themselves, so it cannot disagree with them.',
   delivery:'Delivery facts record dates and status a person confirmed: target, milestone, blocker, next step. Unknown is a valid answer; missing Actual Live does not mean a launch failed.',
   manage:'Manage the initiative: basics, owner, scope / phase, relationships to other initiatives, and mapped source references. Archiving keeps every record and its history.',
   setup:'Setup lists what an initiative needs before its checks are meaningful. Completing setup is not a readiness or approval decision.',
  };
  return byTab[tab??'']??'The Brief summarises where this initiative stands from confirmed records: what needs attention, the next step, relationships, open risks and questions, and what changed since the last Final review.';
 }
 if(path.startsWith('/weekly-review'))return 'A Weekly Review draft compares current initiative records with the previous Final. Your commentary stays in the review; record updates change the initiative only when you confirm them. Finalizing preserves a snapshot for the meeting.';
 if(path.startsWith('/notifications'))return 'Notifications are worked out from the current records: decisions to make, dates due or passed, changes worth a look, and setup or connection problems. “For me” means assigned to you, or unassigned on initiatives you own. Nothing is scored.';
 if(path.startsWith('/account/connections'))return 'Connect your own Jira, Gmail, Google Drive or Figma account to import items you choose as evidence. Prodwise reads only what you select and never changes anything in those tools.';
 if(path.startsWith('/roadmap'))return 'The Roadmap places confirmed dates on a timeline, grouped by business line. Initiatives without a known Target Live are listed separately; an unknown date is never guessed.';
 if(path.startsWith('/analysis'))return 'Analysis summarises recorded delivery facts across the portfolio. Measurements need definitions and observations; missing data is not zero.';
 if(path.startsWith('/administration')||path.startsWith('/users')||path.startsWith('/platform'))return 'Administration changes who can access this organization and how. Platform authority is global; organization membership is scoped to one organization.';
 if(path.startsWith('/initiatives'))return 'Initiatives is your register: stage, owner, setup, attention and Target Live for each initiative. Filter it, or open one to work on it. Archived initiatives stay available under Archived.';
 return 'Home shows what needs attention across your portfolio and why, the next step for each, what is coming up, and what changed since the last Final review.';
}
