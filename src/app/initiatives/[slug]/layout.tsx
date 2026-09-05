import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { WorkspaceHeader } from "@/components/shell/WorkspaceHeader";
import { getRepository } from "@/lib/data";

export const dynamic = "force-dynamic";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const initiative = await getRepository().getInitiativeBySlug(slug);
  const name = initiative?.name ?? "Initiative";

  // A template so each tab reads "Review · Merchant Flex Finance · Prodwise".
  // Without it a child page's title would replace the whole document title.
  // `default` resolves against the ROOT template, so it must not repeat
  // "Prodwise". `template` replaces the root template for child pages, so it
  // must include it. Result: "Review · Merchant Flex Finance · Prodwise".
  return {
    title: {
      default: name,
      template: `%s · ${name} · Prodwise`,
    },
  };
}

export default async function InitiativeLayout({
  children,
  params,
}: LayoutProps) {
  const { slug } = await params;
  const initiative = await getRepository().getInitiativeBySlug(slug);

  if (!initiative) notFound();

  return (
    <>
      <WorkspaceHeader initiative={initiative} />
      {children}
    </>
  );
}
