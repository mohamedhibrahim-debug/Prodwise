import type { SVGProps } from "react";

export type InstrumentIconName = "home" | "initiatives" | "reporting" | "search" | "demo" | "menu" | "pin" | "event" | "evidence" | "decision";

export function InstrumentIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: InstrumentIconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" {...props}>
    {name === "home" && <><path d="m2.5 9 7.5-6 7.5 6v7.5H2.5z" {...common}/><path d="M8 16.5v-5h4v5" {...common}/></>}
    {name === "initiatives" && <><path d="M3 4.5h14M3 10h14M3 15.5h9" {...common}/><circle cx="15.5" cy="15.5" r="1.5" {...common}/></>}
    {name === "reporting" && <><path d="M3.5 3.5v13h13" {...common}/><path d="m6 13 3-3 2 1.5 4-5" {...common}/></>}
    {name === "search" && <><circle cx="8.5" cy="8.5" r="4.5" {...common}/><path d="m12 12 4.5 4.5" {...common}/></>}
    {name === "demo" && <><path d="M7 3.5h6M8 3.5v4l-4 7a1.5 1.5 0 0 0 1.3 2.2h9.4a1.5 1.5 0 0 0 1.3-2.2l-4-7v-4" {...common}/><path d="M6.5 12h7" {...common}/></>}
    {name === "menu" && <path d="M3 5h14M3 10h14M3 15h14" {...common}/>} 
    {name === "pin" && <><path d="m7 3 6 6M12 4l4 4-3 1-4 4-1 3-4-4 3-1 4-4z" {...common}/></>}
    {name === "event" && <><circle cx="10" cy="10" r="6.5" {...common}/><path d="M10 6.5v4l2.5 1.5" {...common}/></>}
    {name === "evidence" && <><path d="M5 3.5h7l3 3v10H5z" {...common}/><path d="M12 3.5v3h3M7.5 10h5M7.5 13h4" {...common}/></>}
    {name === "decision" && <><path d="M10 3.5v13M4 7h12M6.5 7l-2.5 5h5zM13.5 7l-2.5 5h5z" {...common}/></>}
  </svg>;
}
