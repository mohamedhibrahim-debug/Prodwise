import type {Change,PortfolioInput,ReviewSection} from "./types.ts";
import {STAGE_LABEL} from "../domain/labels.ts";
import {displayDate} from "./display.ts";
import {changesSince,factFor} from "./model.ts";
/** Render typed system dates/stages; never rewrite human Knowledge value text. */
export function weeklyChangeSentence(change:Change,input:PortfolioInput,baseline:PortfolioInput|null):string {
 if(change.kind==="STAGE") {const before=baseline?.snapshots.find(s=>s.initiative.id===change.initiativeId),after=input.snapshots.find(s=>s.initiative.id===change.initiativeId);if(before&&after)return `Recorded stage: ${STAGE_LABEL[before.initiative.stage]} → ${STAGE_LABEL[after.initiative.stage]}. This does not infer release readiness.`;}
 if(["TARGET_LIVE","ACTUAL_LIVE","DEV_STARTED","SOLUTION_DEFINED","NEXT_MILESTONE"].includes(change.kind))return change.label.replace(/\b\d{4}-\d{2}-\d{2}\b/g,date=>displayDate(date));
 return change.label;
}

/** Format only exact, identifiable system template fragments. Never mutate the review or
 * reformat arbitrary dates in human notes, Knowledge values, or archived JSON. */
export function displayedCommentary(section:ReviewSection,input:PortfolioInput,baseline:PortfolioInput|null) {
 const text={headline:section.headline,updates:section.updates,attention:section.attention,decisionNeeded:section.decisionNeeded,nextMilestone:section.nextMilestone,nextStep:section.nextStep};
 const snapshot=input.snapshots.find(s=>s.initiative.id===section.initiativeId);
 if(!snapshot)return text;
 const scope=factFor(input.facts,section.initiativeId,"SCOPE")?.value.text??"Scope not confirmed";
 if(text.headline===`${snapshot.initiative.stage.replaceAll("_"," ")} · ${scope}`)text.headline=`${STAGE_LABEL[snapshot.initiative.stage]} · ${scope}`;
 const changes=changesSince(input,baseline).filter(c=>c.initiativeId===section.initiativeId);
 const known=new Map(changes.map(c=>[c.label,weeklyChangeSentence(c,input,baseline)]));
 text.updates=text.updates.split("\n").map(line=>known.get(line)??line).join("\n");
 const milestone=factFor(input.facts,section.initiativeId,"NEXT_MILESTONE");
 if(milestone?.value.date&&text.nextMilestone===`${milestone.value.text} — ${milestone.value.date}`)text.nextMilestone=`${milestone.value.text} — ${displayDate(milestone.value.date)}`;
 return text;
}
