\set ON_ERROR_STOP on
do $$begin if current_database() !~ '^prodwise_second_[0-9a-f]{32}$' then raise exception 'DISPOSABLE_LOCAL_DATABASE_REQUIRED';end if;end$$;
begin;
-- Fictional identities only. AMAN org row exists since 0012; its real exact-email exception is not used here.
update public.organizations set allowed_exact_emails=allowed_exact_emails||array['owner-exception@synthetic-outside.test'],status='ACTIVE' where id='90000000-0000-4000-8000-000000000001';
update public.workspaces set status='ACTIVE' where organization_id='90000000-0000-4000-8000-000000000001';
insert into auth.users(id,email,email_confirmed_at) values
 ('ea000000-0000-4000-8000-000000000001','new.pm@aman.eg',now()),('ea000000-0000-4000-8000-000000000002','analyst@rayacorp.com',now()),
 ('ea000000-0000-4000-8000-000000000003','someone@gmail.com',now()),('ea000000-0000-4000-8000-000000000004','unverified@aman.eg',null),
 ('ea000000-0000-4000-8000-000000000005','owner-exception@synthetic-outside.test',now());
-- The exact-email exception person already exists as Platform Owner + AMAN ORG_OWNER.
insert into public.users(id,email,display_name,auth_user_id,active,is_system,platform_role) values('ea100000-0000-4000-8000-000000000005','owner-exception@synthetic-outside.test','Synthetic Platform Owner','ea000000-0000-4000-8000-000000000005',true,false,'PLATFORM_OWNER');
insert into public.organization_memberships(id,organization_id,user_id,role,active,is_product_lead,policy_override,policy_override_reason) values('ea200000-0000-4000-8000-000000000005','90000000-0000-4000-8000-000000000001','ea100000-0000-4000-8000-000000000005','ORG_OWNER',true,false,false,null);
set local role service_role;
do $$declare aman uuid:='90000000-0000-4000-8000-000000000001';demo uuid:='d2000000-0000-4000-8000-000000000001';r jsonb;mid uuid;n integer;begin
 -- A/B: eligible corporate domains; the organization is only named after verification.
 if not public.check_self_signup(' New.PM@Aman.eg ',null) or not public.check_self_signup('analyst@rayacorp.com',null) then raise exception 'ELIGIBLE_REFUSED';end if;
 r:=public.self_signup_options('ea000000-0000-4000-8000-000000000001');if r#>>'{organizations,0,name}'<>'AMAN' or jsonb_array_length(r->'organizations')<>1 then raise exception 'OPTIONS_WRONG %',r;end if;
 r:=public.complete_self_signup('ea000000-0000-4000-8000-000000000001',aman,'New PM');mid:=(r->>'memberId')::uuid;
 if (select role||':'||joined_via||':'||is_product_lead::text from public.organization_memberships where id=mid)<>'MEMBER:SELF_SIGNUP:false' or (select platform_role from public.users u join public.organization_memberships m on m.user_id=u.id where m.id=mid) is not null then raise exception 'UNSAFE_DEFAULT_ROLE';end if;
 perform public.complete_self_signup('ea000000-0000-4000-8000-000000000002',aman,'Raya Analyst');
 if not exists(select 1 from public.membership_events where action='SELF_SIGNUP' and target_id=mid::text) then raise exception 'NO_ADMIN_TRAIL';end if;
 -- D: random public address cannot self-join AMAN, even by calling completion directly.
 if public.check_self_signup('someone@gmail.com',null) then raise exception 'GMAIL_ELIGIBLE';end if;
 begin perform public.complete_self_signup('ea000000-0000-4000-8000-000000000003',aman,'Outsider');raise exception 'GMAIL_JOINED';exception when others then if sqlerrm<>'SIGNUP_NOT_ALLOWED' then raise;end if;end;
 -- Unverified address cannot complete; no options are disclosed.
 begin perform public.complete_self_signup('ea000000-0000-4000-8000-000000000004',aman,'Unverified');raise exception 'UNVERIFIED_JOINED';exception when others then if sqlerrm<>'EMAIL_NOT_VERIFIED' then raise;end if;end;
 begin perform public.self_signup_options('ea000000-0000-4000-8000-000000000004');raise exception 'UNVERIFIED_OPTIONS';exception when others then if sqlerrm<>'EMAIL_NOT_VERIFIED' then raise;end if;end;
 -- E: organization-id tampering — an org without self sign-up (the Demo) is refused.
 begin perform public.complete_self_signup('ea000000-0000-4000-8000-000000000001',demo,'Tamper');raise exception 'TAMPER_JOINED';exception when others then if sqlerrm<>'SIGNUP_NOT_ALLOWED' then raise;end if;end;
 -- F: duplicate completion is refused; nothing duplicated.
 begin perform public.complete_self_signup('ea000000-0000-4000-8000-000000000001',aman,'Again');raise exception 'DUPLICATE_JOINED';exception when others then if sqlerrm<>'ACCOUNT_EXISTS' then raise;end if;end;
 if (select count(*) from public.organization_memberships m join public.users u on u.id=m.user_id where u.auth_user_id='ea000000-0000-4000-8000-000000000001')<>1 then raise exception 'DUPLICATE_MEMBERSHIP';end if;
 -- C: the exact-email Platform Owner exception still exists and is never downgraded or renamed by sign-up.
 if not public.check_self_signup('owner-exception@synthetic-outside.test',null) then raise exception 'EXCEPTION_NOT_ELIGIBLE';end if;
 if not (public.self_signup_options('ea000000-0000-4000-8000-000000000005')->>'existingIdentity')::boolean then raise exception 'EXISTING_NOT_DETECTED';end if;
 begin perform public.complete_self_signup('ea000000-0000-4000-8000-000000000005',aman,'Hijack name');raise exception 'OWNER_RESIGNED';exception when others then if sqlerrm<>'ACCOUNT_EXISTS' then raise;end if;end;
 if (select role from public.organization_memberships where id='ea200000-0000-4000-8000-000000000005')<>'ORG_OWNER' or (select platform_role||':'||display_name from public.users where id='ea100000-0000-4000-8000-000000000005')<>'PLATFORM_OWNER:Synthetic Platform Owner' then raise exception 'OWNER_CHANGED';end if;
 -- G: a self-signed-up MEMBER cannot elevate their own role.
 begin perform public.change_workspace_membership('10000000-0000-4000-8000-000000000001',mid,mid,'ADMIN',true,false);raise exception 'SELF_ELEVATED';exception when others then if sqlerrm='SELF_ELEVATED' then raise;end if;end;
 if (select role from public.organization_memberships where id=mid)<>'MEMBER' then raise exception 'ROLE_CHANGED';end if;
 -- Rate limit: repeated checks for one address are refused after five in an hour.
 for n in 1..4 loop perform public.check_self_signup('new.pm@aman.eg',null);end loop;
 begin perform public.check_self_signup('new.pm@aman.eg',null);raise exception 'NOT_RATE_LIMITED';exception when others then if sqlerrm<>'RATE_LIMITED' then raise;end if;end;
 -- J: attempts store only hashes, never the typed address.
 if exists(select 1 from public.signup_attempts where email_hash like '%@%') then raise exception 'PLAINTEXT_STORED';end if;
 raise notice 'PASS: aman.eg and rayacorp.com join AMAN as MEMBER via SELF_SIGNUP with audit event; gmail refused (check and direct completion); unverified refused; org-id tampering refused; duplicate refused; Platform Owner exception eligible yet never modified or downgraded; no self-elevation; rate limit; hashed attempts only';
end$$;set constraints all immediate;reset role;rollback;
