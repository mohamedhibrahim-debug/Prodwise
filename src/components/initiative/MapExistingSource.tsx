'use client';
import {useActionState} from 'react';
import {ScopeField} from '@/components/auth/WorkspaceScope';
import {mapExistingSourceAction} from '@/app/initiatives/[slug]/manage/actions';
import styles from './management.module.css';
export function MapExistingSource({itemId,initiatives}:{itemId:string;initiatives:{slug:string;name:string}[]}){
 const [state,action,pending]=useActionState(mapExistingSourceAction,{error:null,message:null});
 return <form action={action} className={styles.form}><ScopeField/><input type="hidden" name="itemId" value={itemId}/><label>Initiative<select name="slug" required defaultValue=""><option value="" disabled>Choose an active initiative</option>{initiatives.map(i=><option value={i.slug} key={i.slug}>{i.name}</option>)}</select></label><label>Role in this initiative<select name="role" defaultValue="GENERAL"><option value="GENERAL">General evidence</option><option value="REQUIREMENTS">Requirements</option><option value="DELIVERY">Delivery</option><option value="DECISIONS">Decisions</option></select></label><div className={styles.actions}><button type="submit" disabled={pending||!initiatives.length}>{pending?'Mapping…':'Map to initiative'}</button></div>{state.error&&<p role="alert">{state.error}</p>}{state.message&&<p role="status">{state.message}</p>}</form>;
}
