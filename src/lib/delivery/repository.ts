import "server-only";
import {readStore,writeStoreWithDelivery} from '@/lib/data/store';
import {withRepositoryContext} from '@/lib/auth/repository-context';
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { getRepository } from "@/lib/data";
import { supabaseServiceRoleKey, supabaseUrl } from "@/lib/env";
import { isLocalAuth, configuredWorkspaceId } from "@/lib/auth/service";
import { requireFreshWorkspaceAccess } from "@/lib/auth/access";
import { localDeliveryPath } from "./local-path";
import { workspacePresentation, type WorkspacePresentation } from "@/lib/workspace/context";
import { LocalDeliveryStore } from "./local-store";
import { deliveryWorkspaceMembers, requireDeliveryAccess, requireDeliveryWriteAccess } from "./access-adapter";
import { assertMember, canonical, meaningful } from "./model";
import type { DeliveryState, PortfolioSource, WorkspaceAccess } from "./types";

function client() { return createClient(supabaseUrl,supabaseServiceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}}); }
function camel(value:unknown):unknown {
  if (Array.isArray(value)) return value.map(camel);
  if (value && typeof value==="object") return Object.fromEntries(Object.entries(value).map(([key,val])=>[key.replace(/_([a-z])/g,(_,letter:string)=>letter.toUpperCase()),camel(val)]));
  return value;
}
export interface DeliveryRead { ctx:WorkspaceAccess; source:PortfolioSource; state:DeliveryState; rawSource:unknown; presentation:WorkspacePresentation; }
function localFor(ctx:WorkspaceAccess) { return new LocalDeliveryStore(localDeliveryPath(process.cwd(),ctx.workspaceId,configuredWorkspaceId())); }
/** Keep ownership stable while a synchronous local product-store edit checks it.
 * Callbacks must commit synchronously; this is not a cross-file transaction. */
export async function withLocalOwnerLock<T>(ctx:WorkspaceAccess, change:(state:DeliveryState)=>T):Promise<T> {
  if(!isLocalAuth())throw new Error('Local ownership lock is unavailable.');
  return localFor(ctx).withReadLock(change);
}
async function readWith(ctx:WorkspaceAccess):Promise<DeliveryRead> {
  const presentationPromise=workspacePresentation(ctx);
  if (!isLocalAuth()) {
    const {data,error}=await client().rpc("delivery_read_workspace",{p_workspace_id:ctx.workspaceId,p_member_id:ctx.memberId ?? ctx.actor.id});
    if (error) throw new Error("Delivery data is unavailable. Check that the Auth and delivery migrations are installed locally.");
    const value=data as {source:unknown;state:DeliveryState}; const source=camel(value.source) as PortfolioSource;
    for (const snapshot of source.snapshots) for (const claim of snapshot.claims) {
      if (!claim.updatedAt || !claim.createdAt) throw new Error("Source claim timestamps are unavailable. Repair the snapshot projection before continuing.");
    }
    assertMember(ctx,source); return {ctx,source,state:value.state,rawSource:value.source,presentation:await presentationPromise};
  }
  if (process.env.VERCEL) throw new Error("Durable delivery storage must be configured before this feature can run on a hosted deployment.");
  const repo=getRepository(); const source={snapshots:await repo.listInitiativeSnapshots(),members:await deliveryWorkspaceMembers(),commitments:await withRepositoryContext(ctx,async()=>readStore().commitments??[])};
  assertMember(ctx,source); return {ctx,source,state:await localFor(ctx).read(),rawSource:meaningful(source),presentation:await presentationPromise};
}
const readForRender=cache(async ():Promise<DeliveryRead> => readWith(await requireDeliveryAccess()));
export async function readDelivery():Promise<DeliveryRead> { return readForRender(); }
/** Mutation orchestration must see product writes made earlier in the same action. */
export async function readDeliveryFresh():Promise<DeliveryRead> { return readWith(await requireFreshWorkspaceAccess()); }
export async function mutateDelivery(change:(read:DeliveryRead)=>Promise<DeliveryState>):Promise<DeliveryState> {
  // Every mutation rechecks the real membership and environment write guard.
  const ctx=await requireDeliveryWriteAccess();
  if (isLocalAuth()) {
    return withRepositoryContext(ctx,async()=>localFor(ctx).transaction(async state=>{
      const read=await readWith(ctx); const next=await change({...read,state});
      const latest=await readWith(await requireDeliveryWriteAccess());
      if (canonical(latest.rawSource)!==canonical(read.rawSource)) throw new Error("Workspace inputs changed while saving. Reload and try again.");
      return next;
    },next=>writeStoreWithDelivery(localFor(ctx).path,next,()=>undefined)));
  }
  for (let attempt=0;attempt<2;attempt++) {
    const activeCtx=await requireDeliveryWriteAccess(); const read=await readWith(activeCtx); const next=await change(read);
    const {error}=await client().rpc("delivery_commit_workspace",{p_workspace_id:activeCtx.workspaceId,p_member_id:activeCtx.memberId ?? activeCtx.actor.id,p_expected_source:read.rawSource,p_expected_state:read.state,p_next_state:next});
    if (!error) return next;
    // An independent PM section may commit while this one was saving. Re-read
    // once and rerun the per-fact/per-section revision guard. Never rebase a
    // changed source, same-section edit, baseline race or membership change.
    if (attempt===0 && error.message.includes("STALE_STATE")) continue;
    throw new Error(error.message.includes("STALE") ? "Workspace data changed while saving. Reload and try again." : "The delivery change was refused. Check your access and reload before retrying.");
  }
  throw new Error("The workspace change could not be saved.");
}
