import type { ComponentProps } from "react";

import { isDemoWriteEnabled, WRITE_DISABLED_MESSAGE } from "@/lib/env";
import { Button, ButtonLink } from "./Button";

/** Presentation only: every mutation is still guarded in the repository. */
export function DemoWriteLink(props: ComponentProps<typeof ButtonLink>) {
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
      {props.children} · Demo mode
    </Button>
  );
}
