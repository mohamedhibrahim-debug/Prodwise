"use client";
import { usePathname } from "next/navigation";
import type { SetupProgress } from "@/lib/workspace/setup";
import { TrustPipeline } from "./TrustPipeline";
export function WorkspacePipeline({ progress, slug }: { progress: SetupProgress; slug: string }) {
  const pathname = usePathname();
  if (pathname === `/initiatives/${slug}`) return null;
  return <TrustPipeline progress={progress} slug={slug} compact />;
}
