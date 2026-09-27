'use server';
import {checkAdminScope,refreshAdministration} from '@/components/admin/action-support';
import {assertReviewedChange} from '@/components/admin/model';
import { platformSetSelfSignup,platformCreateOrganization,platformConfigurePolicy,platformProvisionMembership,platformReplaceOrgOwner,grantPlatformOwner,platformRotateInvitation } from '@/lib/auth/service';
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

export async function selfSignupAction(_state:AuthFormState,form:FormData):Promise<AuthFormState>{
 try{await checkAdminScope(form);assertReviewedChange(form);await platformSetSelfSignup(value(form,'organizationId'),form.get('enabled')==='on',value(form,'reason'));refreshAdministration(form);return {error:null,message:form.get('enabled')==='on'?'Self sign-up is on for this organization. New members join as Member.':'Self sign-up is off. New people need an invitation.'};}catch(e){return {error:authErrorMessage(e,'Self sign-up could not be changed. Nothing was saved; try again.')};}
}

/** One reviewed change for an organization's access policy: allowed addresses and self sign-up together. */
export async function accessPolicyAction(_state:AuthFormState,form:FormData):Promise<AuthFormState>{
 try{
  await checkAdminScope(form);assertReviewedChange(form);
  const organizationId=value(form,'organizationId'),domains=entries(form,'domains'),exactEmails=entries(form,'exactEmails');
  const enabled=form.get('enabled')==='on',wasEnabled=form.get('currentSelfSignup')==='on';
  const policyChanged=domains.join('\n')!==String(form.get('currentDomains')??'')||exactEmails.join('\n')!==String(form.get('currentExactEmails')??'');
  if(!policyChanged&&enabled===wasEnabled)return {error:'Nothing changed. Edit the addresses or the self sign-up setting first.'};
  if(enabled!==wasEnabled&&!value(form,'reason').trim())return {error:'Add a reason for changing self sign-up. It is recorded in platform history.'};
  if(policyChanged)await platformConfigurePolicy(organizationId,domains,exactEmails);
  if(enabled!==wasEnabled){
   try{await platformSetSelfSignup(organizationId,enabled,value(form,'reason'));}
   catch(error){refreshAdministration(form);return {error:(policyChanged?'The allowed addresses were saved, but self sign-up was not changed. ':'')+authErrorMessage(error,'Self sign-up could not be changed. Try again.')};}
  }
  refreshAdministration(form);
  return {error:null,message:[policyChanged&&'Allowed addresses updated.',enabled!==wasEnabled&&(enabled?'Self sign-up is on; new people join as Member.':'Self sign-up is off; new people need an invitation.')].filter(Boolean).join(' ')};
 }catch(error){return {error:authErrorMessage(error,'Could not update this access policy. Nothing was saved; try again.')};}
}
