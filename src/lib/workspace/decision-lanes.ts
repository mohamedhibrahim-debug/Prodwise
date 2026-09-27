export const DECISION_LANES=[
 {key:"open",title:"Open",description:"Current differences requiring a decision."},
 {key:"deferred",title:"Deferred",description:"Returns when its end condition occurs or evidence changes."},
 {key:"dismissed",title:"Dismissed",description:"Dismissed for these exact compared claims."},
 {key:"resolved",title:"Resolved",description:"Decision records and reviewed notes; notes do not change Knowledge."},
 {key:"history",title:"History",description:"Replaced information and append-only queue history."},
] as const;
export type DecisionLaneKey=(typeof DECISION_LANES)[number]["key"];
