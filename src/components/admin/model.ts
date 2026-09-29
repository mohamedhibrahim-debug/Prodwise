export function roleLabel(role:string|null|undefined){return ({ORG_OWNER:"Org Owner",ADMIN:"Admin",MEMBER:"Member",VIEWER:"Viewer",PLATFORM_OWNER:"Platform Owner"} as Record<string,string>)[role??""]??"No membership";}
export function dateLabel(value:string|null|undefined,includeTime=false){if(!value)return "Not recorded";const date=new Date(value);if(Number.isNaN(date.valueOf()))return "Not recorded";return date.toLocaleString("en-GB",{timeZone:"Africa/Cairo",day:"numeric",month:"short",year:"numeric",...(includeTime?{hour:"2-digit",minute:"2-digit"}:{})});}
export function invitationStatus(invite:{usedAt:string|null;revokedAt:string|null;expiresAt:string},now:number){return invite.usedAt?"Accepted":invite.revokedAt?"Revoked":Date.parse(invite.expiresAt)<=now?"Expired":"Pending";}
export function activeOrganizationMembers<T extends {organizationId:string;userId:string;active:boolean}>(members:T[],identities:{id:string;active:boolean}[],organizationId:string){const ids=new Set(identities.filter(x=>x.active).map(x=>x.id));return members.filter(x=>x.organizationId===organizationId&&x.active&&ids.has(x.userId));}
export function assertReviewedChange(form:FormData){if(form.get("reviewConfirmed")!=="yes")throw new Error("Review this change and its consequences before saving.");}

/**
 * One vocabulary for an organization's lifecycle state everywhere it is shown
 * (counts, filters, badges, detail pages). The stored value stays BOOTSTRAPPING;
 * people read "Needs owner", because that is what the state means.
 */
export const ORGANIZATION_STATUSES=["ACTIVE","BOOTSTRAPPING","ARCHIVED"] as const;
export type OrganizationStatus=(typeof ORGANIZATION_STATUSES)[number];
export const ORGANIZATION_STATUS_LABEL:Record<OrganizationStatus,string>={ACTIVE:"Active",BOOTSTRAPPING:"Needs owner",ARCHIVED:"Archived"};
export function organizationStatusLabel(status:string){return (ORGANIZATION_STATUS_LABEL as Record<string,string>)[status]??status.charAt(0)+status.slice(1).toLowerCase();}

/** How a membership was created, as a sentence fragment. */
export function joinedViaLabel(joinedVia:string|null|undefined){return joinedVia==="SELF_SIGNUP"?"Self sign-up":joinedVia==="INVITATION"?"Invitation":joinedVia==="PLATFORM"?"Added by the operator":"Added by an administrator";}

/* ── Information architecture ─────────────────────────────────────────────
   Everyday administration is organised by task; the operator surface (platform
   authority over every organization) is separate and only reachable by a
   Platform Owner. Routes are the source of truth for navigation, breadcrumbs
   and document titles, so the three can never disagree (D-3). */
export const ADMIN_SECTIONS=[
 {key:"organization",label:"Organization",href:"/administration/organization",summary:"What this organization is and how it is set up."},
 {key:"members",label:"Members",href:"/administration/members",summary:"Who has access, invitations, roles and deactivation."},
 {key:"roles",label:"Roles & permissions",href:"/administration/roles",summary:"What each role can do, derived from the access rules in code."},
 {key:"integrations",label:"Integrations",href:"/administration/integrations",summary:"Which sources exist and where each person connects their own account."},
 {key:"preferences",label:"Preferences",href:"/administration/preferences",summary:"Workspace name, appearance and Ask Prodwise."},
 {key:"security",label:"Security & access",href:"/administration/security",summary:"Who can join, how invitations work, and the actions that need care."},
] as const;
export type AdminSectionKey=(typeof ADMIN_SECTIONS)[number]["key"];
export const OPERATOR_HOME="/administration/operator";
export const OPERATOR_SECTIONS=[
 {key:"organizations",label:"Organizations",href:`${OPERATOR_HOME}/organizations`},
 {key:"identities",label:"Identities",href:`${OPERATOR_HOME}/identities`},
 {key:"policies",label:"Access policies",href:`${OPERATOR_HOME}/policies`},
] as const;
export type OperatorSectionKey=(typeof OPERATOR_SECTIONS)[number]["key"];
export const isAdminSection=(key:string):key is AdminSectionKey=>ADMIN_SECTIONS.some(s=>s.key===key);
export const isOperatorSection=(key:string):key is OperatorSectionKey=>OPERATOR_SECTIONS.some(s=>s.key===key);

export interface Crumb{label:string;href?:string}
/** Breadcrumb for any administration path: Administration › section › record. Pure, used by the top bar and page titles. */
export function adminBreadcrumb(path:string):Crumb[]{
 const parts=path.split("?")[0]!.split("/").filter(Boolean);
 const root:Crumb={label:"Administration",href:"/administration"};
 if(parts[0]!=="administration"||parts.length===1)return [{label:"Administration"}];
 const key=parts[1]!,rest=parts.slice(2);
 if(key==="operator"){
  const op:Crumb={label:"Operator",href:OPERATOR_HOME};
  const section=OPERATOR_SECTIONS.find(s=>s.key===rest[0]);
  if(!section)return [root,{label:"Operator"}];
  if(rest.length===1)return [root,op,{label:section.label}];
  const leaf=rest[1]==="new"?"New organization":section.key==="organizations"?"Organization":section.key==="identities"?"Person":"Policy";
  return [root,op,{label:section.label,href:section.href},{label:leaf}];
 }
 const section=ADMIN_SECTIONS.find(s=>s.key===key);
 if(!section)return [root,{label:"Administration"}];
 if(!rest.length)return [root,{label:section.label}];
 const leaf=section.key==="members"?(rest[0]==="invite"?"Invite":"Member"):section.label;
 return [root,{label:section.label,href:section.href},{label:leaf}];
}
/** Document title from the same breadcrumb: "Members · Administration". */
export function adminTitle(path:string){const trail=adminBreadcrumb(path);return trail.length>1?`${trail[trail.length-1]!.label} · Administration`:"Administration";}

/**
 * Routes that moved when administration became task-oriented keep working:
 * every old address answers with its new one, query string included.
 * Returns null when the path is not a legacy address.
 */
export function legacyAdminPath(scope:string,path:string[],query:Record<string,string|undefined>={}):string|null{
 const q=new URLSearchParams();for(const [k,v] of Object.entries(query))if(v)q.set(k,v);const qs=q.toString()?`?${q}`:"";
 if(scope==="organization"){
  if(path[0]==="users"){if(path.length===1)return `/administration/members${qs}`;if(path[1]==="invite")return "/administration/members/invite";return `/administration/members/${encodeURIComponent(path[1]!)}`;}
  if(path[0]==="settings")return "/administration/organization";
  if(path[0]==="policy")return "/administration/security";
  return null;
 }
 if(scope==="platform"){
  const section=path[0]==="users"?"identities":path[0];
  if(!section)return OPERATOR_HOME;
  if(!isOperatorSection(section))return OPERATOR_HOME;
  return `${OPERATOR_HOME}/${section}${path[1]?`/${encodeURIComponent(path[1])}`:""}${qs}`;
 }
 return null;
}

/** Only administration addresses may be used as a return path, so a form can never send someone off the console. */
export function adminReturnPath(value:string|undefined,fallback="/administration"){if(!value||/[\\\u0000- ]/.test(value)||!value.startsWith("/administration"))return fallback;const url=new URL(value,"https://prodwise.invalid");return url.origin==="https://prodwise.invalid"&&/^\/administration(?:\/(?:organization|members|roles|integrations|preferences|security|operator|platform)(?:\/|$)|$)/.test(url.pathname)?url.pathname+url.search:fallback;}
