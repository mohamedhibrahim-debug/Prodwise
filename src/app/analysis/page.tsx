import {redirect} from "next/navigation";
import {readDelivery} from "@/lib/delivery/repository";
export default async function Analysis({searchParams}:{searchParams:Promise<{initiative?:string}>}){const query=await searchParams;if(query.initiative){const {source}=await readDelivery();const i=source.snapshots.find(s=>s.initiative.id===query.initiative)?.initiative;redirect(i?"/analysis/projects/"+i.slug:"/analysis/projects");}redirect("/analysis/business");}
