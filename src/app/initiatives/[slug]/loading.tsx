import { RouteSkeleton } from "@/components/shell/RouteSkeleton";

// Tab switches keep the initiative header and tabs (the layout); only the content area shows this.
export default function Loading() { return <RouteSkeleton scope="initiative-tab" />; }
