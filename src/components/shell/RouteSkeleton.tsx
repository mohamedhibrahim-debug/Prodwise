'use client';
import {usePathname} from 'next/navigation';
import styles from './RouteSkeleton.module.css';

/**
 * Loading placeholders shaped like the destination, inside the same gutter and
 * sheet as the real page, so a slow response reads as "arriving", not broken.
 * The loading boundary renders with the destination URL already committed, so
 * the pathname picks the shape. Text is for screen readers only.
 */
type Shape='home'|'list'|'workspace'|'tab'|'roadmap'|'analysis'|'weekly'|'form';

function shapeFor(path:string,scope:'page'|'initiative-tab'):Shape{
 if(scope==='initiative-tab'){const tab=/^\/initiatives\/[^/]+\/?([^/]*)/.exec(path)?.[1]??'';return tab===''?'workspace':'tab';}
 if(path==='/')return 'home';
 if(path==='/initiatives/new')return 'form';
 if(/^\/initiatives\/[^/]+/.test(path))return 'workspace';
 if(path.startsWith('/roadmap'))return 'roadmap';
 if(path.startsWith('/analysis'))return 'analysis';
 if(path.startsWith('/weekly-review'))return 'weekly';
 if(path.startsWith('/account'))return 'form';
 return 'list';
}

const B=({w,h,className}:{w?:string;h?:number;className?:string})=><span className={`${styles.block} ${className??''}`} style={{width:w,height:h}}/>;

function Rows({count=8,cols=['34%','12%','14%','16%','10%']}:{count?:number;cols?:string[]}){
 return <div className={styles.table}>
  <div className={styles.thead}>{cols.map((w,i)=><B key={i} w={i===0?'14%':'8%'} h={8}/>)}</div>
  {Array.from({length:count},(_,r)=><div key={r} className={styles.row}>{cols.map((w,i)=><B key={i} w={i===0?`calc(${w} - ${(r%3)*4}%)`:w} h={i===0?12:10}/>)}</div>)}
 </div>;
}

function PageHead({actions=true}:{actions?:boolean}){
 return <div className={styles.pageHead}><div className={styles.stack}><B w="220px" h={22}/><B w="340px" h={10}/></div>{actions&&<B w="132px" h={32} className={styles.button}/>}</div>;
}

function Brief(){
 return <div className={styles.columns}>
  <div className={styles.stack}><B w="30%" h={14}/><B w="92%" h={12}/><B w="78%" h={12}/><B w="100%" h={84} className={styles.panel}/><Rows count={4} cols={['40%','30%','14%']}/></div>
  <div className={`${styles.stack} ${styles.side}`}><B w="50%" h={14}/>{[0,1,2,3,4].map(i=><div key={i} className={styles.kv}><B w="40%" h={9}/><B w="64%" h={12}/></div>)}</div>
 </div>;
}

export function RouteSkeleton({scope='page'}:{scope?:'page'|'initiative-tab'}){
 const shape=shapeFor(usePathname(),scope);
 return <div className={styles.wrap} data-shape={shape} aria-busy="true">
  <p className="visually-hidden" role="status">Loading…</p>
  <div aria-hidden="true">
   {shape==='home'&&<div className={styles.page}><PageHead actions={false}/><div className={styles.strip}>{[0,1,2,3,4].map(i=><div key={i} className={styles.stat}><B w="36px" h={18}/><B w="70%" h={9}/></div>)}</div><div className={styles.columns}><div className={styles.stack}>{[0,1,2].map(g=><div key={g} className={styles.group}><B w="38%" h={14}/><B w="100%" h={40} className={styles.panel}/><B w="100%" h={40} className={styles.panel}/></div>)}</div><div className={`${styles.stack} ${styles.side}`}><B w="100%" h={148} className={styles.panel}/>{[0,1,2,3].map(i=><div key={i} className={styles.kv}><B w="30%" h={9}/><B w="70%" h={12}/></div>)}</div></div></div>}
   {shape==='list'&&<div className={styles.page}><PageHead/><div className={styles.toolbar}><B w="240px" h={32} className={styles.button}/><B w="88px" h={28} className={styles.pill}/><B w="96px" h={28} className={styles.pill}/><B w="80px" h={28} className={styles.pill}/></div><Rows/></div>}
   {shape==='workspace'&&<>{scope==='page'&&<div className={styles.workspaceHead}><div className={styles.titleRow}><B w="320px" h={26}/><div className={styles.toolbar}><B w="124px" h={32} className={styles.button}/><B w="140px" h={32} className={styles.button}/></div></div><div className={styles.toolbar}>{[92,64,120,110].map((w,i)=><B key={i} w={`${w}px`} h={24}/>)}</div><div className={styles.tabs}>{[44,70,76,60,96,120,56].map((w,i)=><B key={i} w={`${w}px`} h={10}/>)}</div></div>}<div className={styles.page}><Brief/></div></>}
   {shape==='tab'&&<div className={styles.page}><div className={styles.toolbar}><B w="160px" h={14}/><span className={styles.grow}/><B w="120px" h={28} className={styles.pill}/><B w="120px" h={32} className={styles.button}/></div><Rows count={7} cols={['30%','24%','12%','12%','10%']}/></div>}
   {shape==='roadmap'&&<div className={styles.page}><PageHead/><div className={styles.toolbar}>{[0,1,2,3].map(i=><B key={i} w="96px" h={28} className={styles.pill}/>)}</div><div className={styles.timeline}>{Array.from({length:9},(_,i)=><div key={i} className={styles.lane}><B w="70%" h={11}/><span className={styles.track}><B className={styles.bar} w={`${22+(i*13)%40}%`} h={14}/></span></div>)}</div></div>}
   {shape==='analysis'&&<div className={styles.page}><PageHead actions={false}/><div className={styles.strip}>{[0,1,2,3].map(i=><div key={i} className={styles.stat}><B w="48px" h={20}/><B w="60%" h={9}/></div>)}</div><Rows count={6}/></div>}
   {shape==='weekly'&&<div className={styles.page}><PageHead/><div className={styles.split}><div className={styles.stack}>{Array.from({length:8},(_,i)=><B key={i} w="100%" h={36} className={styles.panel}/>)}</div><div className={styles.stack}><B w="40%" h={18}/><B w="92%" h={12}/><B w="86%" h={12}/><B w="100%" h={160} className={styles.panel}/></div></div></div>}
   {shape==='form'&&<div className={styles.page}><PageHead actions={false}/><div className={styles.form}>{[0,1,2,3].map(i=><div key={i} className={styles.stack}><B w="120px" h={10}/><B w="100%" h={36} className={styles.button}/></div>)}</div></div>}
  </div>
 </div>;
}
