'use client';
import { DateField } from '@/components/forms/DateField';
import {useFormAction} from '@/components/forms/useFormAction';
import {useState} from 'react';
import Link from 'next/link';
import {ScopeField} from '@/components/auth/WorkspaceScope';
import {commitmentAction} from '@/app/initiatives/[slug]/actions/actions';
import type {DeliveryMember} from '@/lib/delivery/types';
import styles from '@/components/initiative/commitments.module.css';
export function MakeCommitment({slug,reviewId,reviewRevision,line,ownerId,members}:{slug:string;reviewId:string;reviewRevision:number;line:string;ownerId:string|null;members:DeliveryMember[]}){
 const [requestId]=useState(()=>crypto.randomUUID());const [state, action, pending, keepAction] = useFormAction(commitmentAction,{error:null});
 if(state.id)return <p role="status">Commitment created · <Link prefetch={false} href={`/initiatives/${slug}/actions?action=${state.id}`}>Open commitment</Link></p>;
 return <details><summary>Make commitment: {line.length>100?line.slice(0,100)+'…':line}</summary><p>This creates an initiative commitment from the saved next step. Review the title, assignee and date before confirming.</p><form action={action} onReset={keepAction} className={styles.form}><ScopeField/><input type="hidden" name="slug" value={slug}/><input type="hidden" name="requestId" value={requestId}/><input type="hidden" name="revision" value="0"/><input type="hidden" name="status" value="OPEN"/><input type="hidden" name="reviewId" value={reviewId}/><input type="hidden" name="reviewRevision" value={reviewRevision}/><input type="hidden" name="reviewLine" value={line}/><fieldset disabled={pending}><label>Commitment title<input name="title" required maxLength={200} defaultValue={line.slice(0,200)}/></label><label>Assignee<select name="assigneeMemberId" defaultValue={ownerId??''}><option value="">No assignee</option>{members.filter(m=>m.active&&m.role!=='VIEWER').map(m=><option key={m.id} value={m.id}>{m.displayName}</option>)}</select></label><label>Due date · optional<DateField name="dueDate"/></label><p>No date is inferred from the commentary. Choose one explicitly or leave it unknown.</p><button className="pw-btn" data-variant="primary" type="submit">{pending?'Creating…':'Confirm commitment'}</button></fieldset>{state.error&&<p role="alert">{state.error}</p>}</form></details>;
}
