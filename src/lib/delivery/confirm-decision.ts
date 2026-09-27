import type {Repository} from "../data/repository.ts";
import type {Actor,NewClaimInput,VerificationBasis} from "../domain/types.ts";
/** Creation and confirmation are separate existing Knowledge writes, never a second decision store. */
export async function createConfirmedDecision(repo:Pick<Repository,"createClaim"|"getClaim"|"setClaimEvidence"|"setEvidenceAnchor"|"verifyClaim">,input:NewClaimInput,confirmation:{basis:VerificationBasis;note:string;evidenceId:string|null;locator:string|null;actor:Actor},created:(id:string)=>void=()=>{}) {
  const claim=await repo.createClaim(input);created(claim.id);
  try {
    if(confirmation.basis==="EVIDENCE") {
      if(!confirmation.evidenceId)throw new Error("Choose current-scope evidence.");
      await repo.setClaimEvidence(claim.id,[confirmation.evidenceId]);
      if(confirmation.locator)await repo.setEvidenceAnchor(claim.id,confirmation.evidenceId,{locator:confirmation.locator,excerpt:null,actor:confirmation.actor});
    }
    const current=await repo.getClaim(claim.id);
    if(!current||["initiativeId","type","subject","attribute","value","domain","phase"].some(key=>current[key as keyof typeof current]!==claim[key as keyof typeof claim])||current.status!=="UNVERIFIED")throw new Error("The newly created decision changed before confirmation. Reload its Knowledge record.");
    await repo.verifyClaim(claim.id,{expectedUpdatedAt:current.updatedAt,basis:confirmation.basis,note:confirmation.note,actor:confirmation.actor});
    const persisted=await repo.getClaim(claim.id);
    if(!persisted||persisted.status!=="ACTIVE"||!persisted.verifiedAt||persisted.verifiedActorId!==confirmation.actor.id||["initiativeId","type","subject","attribute","value","domain","phase"].some(key=>persisted[key as keyof typeof persisted]!==claim[key as keyof typeof claim]))throw new Error("Confirmation was not verified in persisted Knowledge. Reload the record before continuing.");
    return persisted;
  } catch(error) {
    throw new Error(`Decision record created but confirmation failed. Its confirmation is incomplete in Knowledge (${claim.id}); reload that record instead of creating it again. ${error instanceof Error?error.message:"Confirmation refused."}`);
  }
}
