import { NotAvailable } from "@/components/errors/NotAvailable";

/** Reached when a page calls notFound() itself; the proxy normally answers first with a real 404. */
export default function InitiativeNotFound() {
  return <NotAvailable kind="initiative" />;
}
