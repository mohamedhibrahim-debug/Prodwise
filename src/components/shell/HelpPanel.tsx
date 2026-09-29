'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {RESTART_ORIENTATION,orientationStorageKey} from './FirstRunOrientation';
import {InstrumentIcon} from './InstrumentIcon';
import {OPEN_HELP,setHelpOpen} from './events';
import {SHORTCUT_GROUPS} from './shortcuts';
import type {ShellIdentity} from './ShellIdentity';
import styles from './HelpPanel.module.css';
export {OPEN_HELP} from './events';

/**
 * Help (audit §E9): a right-side panel that does not block the page.
 * "On this page" is contextual per route; the shortcut sheet and orientation
 * restart live here too. Closes on Escape, an outside press or navigation,
 * and returns focus to whatever opened it.
 */
export function HelpPanel({identity}:{identity:ShellIdentity}){
 const [open,setOpen]=useState(false);
 const panel=useRef<HTMLElement>(null);const origin=useRef<HTMLElement|null>(null);const shortcuts=useRef<HTMLHeadingElement>(null);const title=useRef<HTMLHeadingElement>(null);
 const path=usePathname();const router=useRouter();
 const close=useCallback((restore=true)=>{setOpen(false);if(restore)origin.current?.focus?.({preventScroll:true});},[]);
 useEffect(()=>{setHelpOpen(open);return()=>setHelpOpen(false);},[open]);

 useEffect(()=>{
  function show(e:Event){
   const section=(e as CustomEvent<{section?:string}>).detail?.section;
   if(!panel.current?.contains(document.activeElement))origin.current=document.activeElement as HTMLElement;
   setOpen(true);
   requestAnimationFrame(()=>{const target=section==='shortcuts'?shortcuts.current:title.current;target?.scrollIntoView({block:'start'});target?.focus({preventScroll:true});});
  }
  window.addEventListener(OPEN_HELP,show);return()=>window.removeEventListener(OPEN_HELP,show);
 },[]);
 const lastPath=useRef(path);
 useEffect(()=>{if(lastPath.current!==path){lastPath.current=path;close(false);}},[path,close]);
 useEffect(()=>{
  if(!open)return;
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!document.querySelector('[role=menu]')){e.preventDefault();close();}};
  const down=(e:PointerEvent)=>{const t=e.target as Element;if(panel.current&&!panel.current.contains(t)&&!t.closest?.('[aria-label="Help"],[data-help-trigger]'))close(false);};
  document.addEventListener('keydown',key);document.addEventListener('pointerdown',down,true);
  return()=>{document.removeEventListener('keydown',key);document.removeEventListener('pointerdown',down,true);};
 },[open,close]);

 const about=helpFor(path);
 return <aside ref={panel} className={styles.panel} data-open={open||undefined} id="help-panel" aria-labelledby="help-title" role="complementary" hidden={!open}>
  <header className={styles.head}><h2 id="help-title" ref={title} tabIndex={-1}>Help</h2><button type="button" className="pw-btn" data-variant="ghost" data-size="sm" data-icon-only="" onClick={()=>close()} aria-label="Close Help" data-tip="Close" data-tip-kbd="Esc"><InstrumentIcon name="close"/></button></header>
  <div className={styles.body}>
   <section><h3>On this page</h3><p>{about}</p></section>
   <section><h3>How Prodwise works</h3><p>Sources are evidence, not truth. Prodwise can propose facts from them; a person confirms what becomes Knowledge, a decision or a delivery date. Home, the Roadmap, Notifications and the Weekly Review all read those same confirmed records.</p><p>Unknown dates and unrecorded facts stay unknown. Checks compare recorded values; they do not assess release readiness or business impact.</p></section>
   <section><h3 ref={shortcuts} tabIndex={-1}>Keyboard shortcuts</h3>
    {SHORTCUT_GROUPS.map(group=><div key={group.title} className={styles.group}><h4>{group.title}</h4><dl>{group.items.map(item=><div key={item.label}><dt>{item.keys.map((k,i)=><kbd key={i} className="pw-kbd">{k}</kbd>)}</dt><dd>{item.label}</dd></div>)}</dl></div>)}
    <p className={styles.note}>Shortcuts are ignored while you are typing in a field.</p>
   </section>
   <section><h3>Orientation</h3><p>The short Home introduction can be shown again at any time.</p><button type="button" className="pw-btn" data-variant="secondary" data-size="sm" onClick={()=>{try{localStorage.removeItem(orientationStorageKey(identity));}catch{}window.dispatchEvent(new Event(RESTART_ORIENTATION));close(false);if(path!=='/')router.push('/');}}><InstrumentIcon name="restart"/>Restart orientation</button></section>
  </div>
 </aside>;
}

/** Short, current guidance for the page the person is on. */
function helpFor(path:string):string{
 const tab=/^\/initiatives\/[^/]+(?:\/([^/?#]+))?/.exec(path)?.[1]??null, inInitiative=/^\/initiatives\/(?!new\b)[^/]+/.test(path);
 if(inInitiative){
  const byTab:Record<string,string>={
   decisions:'Decisions lists places where confirmed Knowledge entries record different values for the same thing. Compare the sources, then record a decision, defer it, or dismiss it with a reason. Nothing is decided for you.',
   knowledge:'Knowledge holds what is recorded as true, with its scope, sources and confirmation. Entries you add or accept start as awaiting confirmation; replaced entries stay in history.',
   sources:'Sources holds the material behind Knowledge: documents, Jira work, pasted text and meeting notes. Refreshing a connected source saves a new snapshot only if it changed.',
   evidence:'Saved meeting notes and pasted text. Open one to review what was proposed from it; accept, edit or reject each proposal. Only accepted items change the initiative.',
   actions:'Commitments are promises people made — from reviews, meetings and decisions — with an owner and a due date. They are not delivery tickets.',
   context:'Risks & questions tracks open risks (recorded in Knowledge first) and questions that need an answer by a date. Answering with a Knowledge entry keeps the answer traceable.',
   history:'History shows how this initiative changed and who changed it, newest first. It is built from the records themselves, so it cannot disagree with them.',
   delivery:'Delivery facts record dates and status a person confirmed: target, milestone, blocker, next step. Unknown is a valid answer; a missing Actual Live does not mean a launch failed.',
   manage:'Manage the initiative: basics, owner, scope or phase, relationships to other initiatives, and mapped source references. Archiving keeps every record and its history.',
   setup:'Setup lists what an initiative needs before its checks are meaningful. Completing setup is not a readiness or approval decision.',
  };
  return byTab[tab??'']??'The Brief summarises where this initiative stands from confirmed records: what needs attention, the next step, relationships, open risks and questions, and what changed since the last Final review.';
 }
 if(path.startsWith('/weekly-review'))return 'A Weekly Review draft compares current initiative records with the previous Final. Your commentary stays in the review; record updates change the initiative only when you confirm them. Finalizing preserves a snapshot for the meeting.';
 if(path.startsWith('/notifications'))return 'Notifications are worked out from the current records: decisions to make, dates due or passed, changes worth a look, and setup or connection problems. “For me” means assigned to you, or unassigned on initiatives you own. Nothing is scored.';
 if(path.startsWith('/account/connections'))return 'Connect your own accounts to import items you choose as evidence. Prodwise reads only what you select and never changes anything in those tools.';
 if(path.startsWith('/account'))return 'Your identity, your access in the current organization, and account security.';
 if(path.startsWith('/roadmap'))return 'The Roadmap places confirmed dates on a timeline, grouped by business line. Initiatives without a known Target Live are listed separately; an unknown date is never guessed.';
 if(path.startsWith('/analysis'))return 'Analysis summarises recorded delivery facts across the portfolio. Measurements need definitions and observations; missing data is not zero.';
 if(path.startsWith('/administration')||path.startsWith('/users')||path.startsWith('/platform'))return 'Administration changes who can access this organization and how. Platform authority is global; organization membership is scoped to one organization.';
 if(path==='/initiatives/new')return 'Create an initiative with a name, business line, owner and stage. Everything else can be completed later in Setup.';
 if(path.startsWith('/initiatives'))return 'Initiatives is your register: stage, owner, setup, attention and Target Live for each initiative. Filter it, or open one to work on it. Archived initiatives stay available under Archived.';
 return 'Home shows what needs attention across your portfolio and why, the next step for each, what is coming up, and what changed since the last Final review.';
}
