import { headers } from "next/headers";
import { NotAvailable } from "@/components/errors/NotAvailable";

/** The proxy marks requests whose record is missing, so the 404 keeps the specific wording. */
export default async function NotFound() {
  const missing = (await headers()).get("x-prodwise-missing");
  return <NotAvailable kind={missing === "initiative" || missing === "record" ? missing : "page"} />;
}
