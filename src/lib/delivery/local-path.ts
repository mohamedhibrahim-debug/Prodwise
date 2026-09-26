import { resolve } from "node:path";

/** Preserve the existing local workspace history while isolating every other
 * organization in its own durable file. IDs come from verified sessions. */
export function localDeliveryPath(root:string, workspaceId:string, originalWorkspaceId:string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId)) throw new Error("A verified workspace is required.");
  return workspaceId === originalWorkspaceId
    ? resolve(root,".data","prodwise-delivery-weekly.json")
    : resolve(root,".data","delivery",`${workspaceId}.json`);
}
