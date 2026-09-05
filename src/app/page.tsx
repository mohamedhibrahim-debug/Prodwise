import { redirect } from "next/navigation";

/** Initiatives is the main level of the product. There is no chat homepage. */
export default function Home() {
  redirect("/initiatives");
}
