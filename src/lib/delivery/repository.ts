import "server-only";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { getRepository } from "@/lib/data";
import { isSupabaseConfigured, supabaseServiceRoleKey, supabaseUrl } from "@/lib/env";
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
export interface DeliveryRead { ctx:WorkspaceAccess; source:PortfolioSource; state:DeliveryState; rawSource:unknown; }
const local = new LocalDeliveryStore(resolve(process.cwd(),".data","prodwise-delivery-weekly.json"));
async function readWith(ctx:WorkspaceAccess):Promise<DeliveryRead> {
  if (isSupabaseConfigured) {
    const {data,error}=await client().rpc("delivery_read_workspace",{p_workspace_id:ctx.workspaceId,p_member_id:ctx.memberId ?? ctx.actor.id});
    if (error) throw new Error("Delivery data is unavailable. Check that the Auth and delivery migrations are installed locally.");
    const value=data as {source:unknown;state:DeliveryState}; const source=camel(value.source) as PortfolioSource;
    for (const snapshot of source.snapshots) for (const claim of snapshot.claims) {
      if (!claim.updatedAt || !claim.createdAt) throw new Error("Source claim timestamps are unavailable. Repair the snapshot projection before continuing.");
    }
    assertMember(ctx,source); return {ctx,source,state:value.state,rawSource:value.source};
  }
  if (process.env.VERCEL) throw new Error("Durable delivery storage must be configured before this feature can run on a hosted deployment.");
  const repo=getRepository(); const source={snapshots:await repo.listInitiativeSnapshots(),members:await deliveryWorkspaceMembers()};
  assertMember(ctx,source); return {ctx,source,state:await local.read(),rawSource:meaningful(source)};
}
export async function readDelivery():Promise<DeliveryRead> { return readWith(await requireDeliveryAccess()); }
export async function mutateDelivery(change:(read:DeliveryRead)=>Promise<DeliveryState>):Promise<DeliveryState> {
  // Every mutation rechecks the real membership and environment write guard.
  const ctx=await requireDeliveryWriteAccess();
  if (!isSupabaseConfigured) {
    return local.transaction(async state=>{
      const read=await readWith(ctx); const next=await change({...read,state});
      const latest=await readWith(await requireDeliveryWriteAccess());
      if (canonical(latest.rawSource)!==canonical(read.rawSource)) throw new Error("Workspace inputs changed while saving. Reload and try again.");
      return next;
    });
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
