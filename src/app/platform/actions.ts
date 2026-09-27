'use server';
import {checkAdminScope,refreshAdministration} from '@/components/admin/action-support';
import {assertReviewedChange} from '@/components/admin/model';
import { platformCreateOrganization,platformConfigurePolicy,platformProvisionMembership,platformReplaceOrgOwner,grantPlatformOwner,platformRotateInvitation } from '@/lib/auth/service';
import { authErrorMessage } from '@/lib/auth/errors';
import type { Role } from '@/lib/auth/core';
import type { AuthFormState } from '@/components/auth/AuthForm';
const value=(form:FormData,key:string)=>String(form.get(key)??'');
const entries=(form:FormData,key:string)=>value(form,key).split(/[,\s]+/).filter(Boolean);
export async function createOrganizationAction(_state:AuthFormState,form:FormData):Promise<AuthFormState>{
 try{await checkAdminScope(form);await platformCreateOrganization(value(form,'name'),entries(form,'domains'),entries(form,'exactEmails'));refreshAdministration(form);return {error:null,message:'Organization created. Assign an Org Owner to activate it.'};}
 catch(error){return {error:authErrorMessage(error,'Could not create this organization.')};}
}
export async function configurePolicyAction(_state:AuthFormState,form:FormData):Promise<AuthFormState>{
 try{await checkAdminScope(form);assertReviewedChange(form);await platformConfigurePolicy(value(form,'organizationId'),entries(form,'domains'),entries(form,'exactEmails'));refreshAdministration(form);return {error:null,message:'Organization access policy updated.'};}
 catch(error){return {error:authErrorMessage(error,'Could not update this access policy.')};}
}
export async function provisionMembershipAction(_state:AuthFormState,form:FormData):Promise<AuthFormState>{
 try{await checkAdminScope(form);assertReviewedChange(form);const result=await platformProvisionMembership(value(form,'organizationId'),value(form,'email'),value(form,'role') as Role,form.get('policyOverride')==='on',value(form,'reason'));refreshAdministration(form);return {error:null,message:result.invitationToken?'Invitation created for this organization. Share the link privately.':'Organization access granted and recorded.',link:result.invitationToken?`/invite/${result.invitationToken}`:undefined};}
 catch(error){return {error:authErrorMessage(error,'Could not grant organization access.')};}
}
export async function replaceOrgOwnersAction(_state:AuthFormState,form:FormData):Promise<AuthFormState>{
 try{await checkAdminScope(form);assertReviewedChange(form);await platformReplaceOrgOwner(value(form,'organizationId'),value(form,'userId'),value(form,'reason'));refreshAdministration(form);return {error:null,message:'Organization ownership replaced in one recorded operation. Previous Org Owners now have Admin access.'};}
 catch(error){return {error:authErrorMessage(error,'Could not replace organization ownership.')};}
}
export async function grantPlatformOwnerAction(_state:AuthFormState,form:FormData):Promise<AuthFormState>{
 try{await checkAdminScope(form);await grantPlatformOwner(value(form,'userId'),value(form,'reason'));refreshAdministration(form);return {error:null,message:'Global Platform Owner authority granted and recorded.'};}
 catch(error){return {error:authErrorMessage(error,'Could not grant platform authority.')};}
}
export async function platformInvitationAction(_state:AuthFormState,form:FormData):Promise<AuthFormState>{
 try{await checkAdminScope(form);const token=await platformRotateInvitation(value(form,'invitationId'),value(form,'operation')==='revoke',value(form,'reason'));refreshAdministration(form);return {error:null,message:token?'Invitation replaced. The previous link is invalid.':'Platform invitation revoked.',link:token?`/invite/${token}`:undefined};}
 catch(error){return {error:authErrorMessage(error,'Could not update this platform invitation.')};}
}
