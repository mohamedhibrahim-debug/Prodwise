import {redirect} from "next/navigation";
/** Kept as an address: the operator surface now lives under Administration. */
export default function Platform(){redirect("/administration/operator/organizations");}
