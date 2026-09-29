'use client';
import {useEffect,useState} from 'react';
import {DEFAULT_PREFERENCES,type AssistantPreferences} from '@/lib/assistant/preferences-model';
import {loadPreferences,savePreferences,usePreferenceState,type SaveOutcome} from './preferences-store';
import styles from './preferences.module.css';

/**
 * My account → Ask Prodwise. Four personal settings in the Account page's
 * radio grammar (the Appearance choice), saved as they are chosen with an
 * honest notice. A shared Demo guest session keeps the choice in memory only
 * and says so; nothing here is a product record.
 */
type Key=keyof AssistantPreferences;
interface Field<K extends Key>{key:K;label:string;description:string;options:{value:AssistantPreferences[K];label:string;hint?:string}[]}
const FIELDS:[Field<'show'>,Field<'language'>,Field<'openBehaviour'>,Field<'proactive'>]=[
 {key:'show',label:'Show assistant',description:'The Ask Prodwise control in the top bar (the mobile bar on phones).',options:[{value:true,label:'On'},{value:false,label:'Off',hint:'Nothing is mounted: no control, no requests.'}]},
 {key:'language',label:'Preferred language',description:'Auto follows the language you write in; product terms stay in English either way.',options:[{value:'auto',label:'Auto'},{value:'en',label:'English'},{value:'ar',label:'Arabic',hint:'العربية'}]},
 {key:'openBehaviour',label:'Open behaviour',description:'Whether the panel starts as you last left it in this browser.',options:[{value:'remember',label:'Remember previous state'},{value:'collapsed',label:'Always start collapsed'}]},
 {key:'proactive',label:'Proactive suggestions',description:'A single dot on the control when a recorded recommendation exists for the screen you are on. Never a push, never an auto-open.',options:[{value:false,label:'Off'},{value:true,label:'On'}]},
];
const NOTICE:Record<SaveOutcome,string>={saved:'Saved.',demo:'Not saved for demo access — applies until you leave.',failed:'Could not be saved. Your previous setting is kept.'};

export function AssistantPreferencesSection({actorId,guest}:{actorId:string;guest:boolean}){
 const state=usePreferenceState();
 useEffect(()=>{void loadPreferences(actorId);},[actorId]);
 const [notice,setNotice]=useState<string|null>(null);
 const ready=state.status==='ready'&&state.actorId===actorId;
 const prefs=ready?state.preferences:DEFAULT_PREFERENCES;
 const choose=async<K extends Key>(key:K,value:AssistantPreferences[K])=>{
  if(prefs[key]===value)return;
  const outcome=await savePreferences({[key]:value} as Partial<AssistantPreferences>);
  setNotice(NOTICE[outcome]);
 };
 return <div className={styles.fields}>
  {FIELDS.map(f=><div key={f.key} className={styles.field}>
   <div className={styles.fieldText}><strong id={`ask-pref-${f.key}`}>{f.label}</strong><small>{f.description}</small></div>
   <div className={styles.choice} role="radiogroup" aria-labelledby={`ask-pref-${f.key}`} onKeyDown={e=>{
    // One tab stop per group; arrow keys move and select.
    const step=e.key==='ArrowRight'||e.key==='ArrowDown'?1:e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:0;if(!step||!ready)return;
    e.preventDefault();const i=f.options.findIndex(o=>prefs[f.key]===o.value),n=(Math.max(0,i)+step+f.options.length)%f.options.length,group=e.currentTarget;
    void choose(f.key,f.options[n]!.value as never);requestAnimationFrame(()=>group.querySelectorAll<HTMLButtonElement>('[role=radio]')[n]?.focus());
   }}>
    {f.options.map((o,oi)=><button key={String(o.value)} type="button" role="radio" tabIndex={prefs[f.key]===o.value||(!f.options.some(x=>prefs[f.key]===x.value)&&oi===0)?0:-1} aria-checked={prefs[f.key]===o.value} className={styles.option} disabled={!ready} onClick={()=>{void choose(f.key,o.value as never);}}>
     <span className={styles.mark} aria-hidden="true"><i/></span>
     <span className={styles.optionText}><span>{o.label}</span>{o.hint&&<small lang={f.key==='language'&&o.value==='ar'?'ar':undefined}>{o.hint}</small>}</span>
    </button>)}
   </div>
  </div>)}
  <p className={styles.status} role="status">{!ready?'Reading your preferences…':guest?'Not saved for demo access — choices apply until you leave.':notice??(state.persisted?'Saved to your account; applies on every device.':'Using defaults; your saved preferences could not be read.')}</p>
 </div>;
}
