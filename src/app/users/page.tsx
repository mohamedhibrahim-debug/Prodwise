import {redirect} from "next/navigation";
/** Kept as an address: members are managed under Administration → Members. */
export default function Users(){redirect("/administration/members");}
