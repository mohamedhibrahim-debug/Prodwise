import {supportChanged} from '@/lib/delivery/model';
import {isDemoWriteEnabled} from '@/lib/env';
import type {DeliveryFact,DeliveryMember,PortfolioSource,WorkspaceAccess} from '@/lib/delivery/types';
import {FactLedger} from './FactLedger';
export {FACT_LABELS} from './FactLedger';
export function memberLabel(members:DeliveryMember[],id:string|null):string {if(!id)return 'Unassigned';const m=members.find(m=>m.id===id);return m?`${m.displayName}${m.active?'':' (inactive)'}`:'Owner unavailable';}
export function FactEditor(props:{initiativeId:string;facts:DeliveryFact[];source:PortfolioSource;ctx:WorkspaceAccess}) {return <FactLedger {...props} writesEnabled={isDemoWriteEnabled} changedSupportIds={props.facts.filter(f=>f.initiativeId===props.initiativeId&&supportChanged(f,props.source)).map(f=>f.id)}/>;}
