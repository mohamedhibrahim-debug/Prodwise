do $$ declare cid uuid := 'cccc0001-0000-4000-8000-000000000008'; begin
 begin update claims set origin='HUMAN_ENTRY' where id=cid; raise exception 'origin edit accepted'; exception when others then if sqlerrm='origin edit accepted' then raise; end if; end;
 begin update claims set status='ACTIVE' where id=cid; raise exception 'unverified activation accepted'; exception when others then if sqlerrm='unverified activation accepted' then raise; end if; end;
 begin insert into claims(initiative_id,type,status,subject,attribute,value,domain) values('11111111-1111-4111-8111-111111111111','RISK','ACTIVE','Human','Active','No trust','RISK'); raise exception 'human active accepted'; exception when check_violation then null; end;
 begin update claims set verified_actor_label='Edited' where id='cccc0001-0000-4000-8000-000000000001'; raise exception 'verifier edit accepted'; exception when others then if sqlerrm='verifier edit accepted' then raise; end if; end;
 begin insert into claims(initiative_id,type,status,subject,attribute,value,domain,verified_at,verified_actor_label,verification_basis,verification_note) values('11111111-1111-4111-8111-111111111111','RISK','ACTIVE','Human','Direct','Blank','RISK',now(),'Actor','DIRECT_KNOWLEDGE',' '); raise exception 'blank direct note accepted'; exception when check_violation then null; end;
 begin insert into activity_log(initiative_id,event_type,summary,entity_type) values('11111111-1111-4111-8111-111111111111','X','x','claim'); raise exception 'bad entity accepted'; exception when check_violation then null; end;
 begin insert into activity_log(initiative_id,event_type,summary,payload) values('11111111-1111-4111-8111-111111111111','X','x','[]'); raise exception 'array payload accepted'; exception when check_violation then null; end;
 begin update claim_evidence set locator=' ' where claim_id='cccc0001-0000-4000-8000-000000000003'; raise exception 'blank locator accepted'; exception when check_violation then null; end;
 begin update claim_evidence set excerpt=repeat('x',2001) where claim_id='cccc0001-0000-4000-8000-000000000003'; raise exception 'long excerpt accepted'; exception when check_violation then null; end;
end $$;
