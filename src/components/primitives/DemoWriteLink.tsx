import type { ComponentProps } from "react";

import { businessWritePresentation } from "@/lib/auth/presentation";
import { Button, ButtonLink } from "./Button";

/** Presentation only: every mutation is still guarded in the repository. */
export async function DemoWriteLink(props: ComponentProps<typeof ButtonLink>) {
  const { enabled: isDemoWriteEnabled, message: WRITE_DISABLED_MESSAGE } = await businessWritePresentation();
  if (isDemoWriteEnabled) return <ButtonLink {...props} />;

  return (
    <Button
      type="button"
      variant={props.variant}
      size={props.size}
      className={props.className}
      disabled
      title={WRITE_DISABLED_MESSAGE}
    >
      {props.children}
    </Button>
  );
}
