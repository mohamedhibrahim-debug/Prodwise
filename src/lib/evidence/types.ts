import type {ClaimType,Domain} from '../domain/types';
export type ProposalType=ClaimType|'DELIVERY'|'ACTION'|'OPEN_QUESTION'|'CHANGED_REQUIREMENT'|'RELATIONSHIP';
export type SubmissionKind='PASTED'|'MEETING_NOTES';
export interface ProposalPayload {subject:string;attribute:string;value:string;domain:Domain;phase:string|null;factKind?:'TARGET_LIVE'|'NEXT_MILESTONE'|'DEV_STARTED'|'ACTUAL_LIVE';date?:string|null;extent?:'PARTIAL'|'FULL'|null;
 /** CHANGED_REQUIREMENT: the existing claim this proposes to supersede, pinned to the revision that was read. */
 targetClaimId?:string;targetClaimUpdatedAt?:string;
 /** RELATIONSHIP: an initiative named verbatim in the quote. Type and rationale are chosen by the confirming human. */
 targetInitiativeId?:string;}
export interface Submission {id:string;workspaceId:string;organizationId:string;initiativeId:string;sourceItemId:string;evidenceId:string;kind:SubmissionKind;title:string;text:string;textSha256:string;charLength:number;createdBy:string;createdAt:string;requestId:string;}
export interface ReadingAttempt {id:string;workspaceId:string;initiativeId:string;submissionId:string;requestId:string;status:'READING'|'READY'|'TIMED_OUT'|'FAILED'|'STOPPED';startedAt:string;endedAt:string|null;errorCode:string|null;model:string|null;promptVersion:string;discardedCount:number;}
export interface Anchor {id:string;workspaceId:string;initiativeId:string;submissionId:string;start:number;end:number;quote:string;}
export interface Proposal {id:string;workspaceId:string;initiativeId:string;submissionId:string;attemptId:string;anchorId:string;type:ProposalType;payload:ProposalPayload;version:number;baseRevision:number;status:'PENDING'|'CONFIRMED'|'REJECTED'|'SUPERSEDED_BY_HUMAN_ENTRY'|'OUTDATED';decidedBy:string|null;decidedAt:string|null;reason:string|null;resultType:string|null;resultId:string|null;}
export interface Confirmation {proposalId:string;workspaceId:string;initiativeId:string;proposalVersion:number;actorId:string;actorLabel:string;at:string;resultType:string;resultId:string;requestId:string;}
/** Corrections to title/date/attendees are revision-checked; the pasted text never changes. */
export interface MeetingNote {submissionId:string;workspaceId:string;initiativeId:string;title:string;meetingDate:string;attendeesText:string|null;revision:number;createdBy:string;createdAt:string;updatedBy:string;updatedAt:string;}
export interface EvidenceState {meetings?:MeetingNote[];submissions:Submission[];attempts:ReadingAttempt[];anchors:Anchor[];proposals:Proposal[];confirmations:Confirmation[];}
export const emptyEvidence=():EvidenceState=>({meetings:[],submissions:[],attempts:[],anchors:[],proposals:[],confirmations:[]});
