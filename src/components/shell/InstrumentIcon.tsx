import type { SVGProps } from "react";

/**
 * One outline icon set: 20px grid, 1.5px stroke, round caps. Every navigation
 * destination has its own glyph so the collapsed rail stays readable.
 */
export type InstrumentIconName =
  | "home" | "initiatives" | "roadmap" | "weekly" | "analysis" | "reporting" | "search" | "demo" | "menu" | "pin"
  | "event" | "evidence" | "decision" | "administration" | "bell" | "help" | "sidebar-collapse" | "sidebar-expand"
  | "logout" | "user" | "keyboard" | "plug" | "check" | "chevrons" | "chevron-down" | "switch" | "close" | "plus"
  | "restart" | "book" | "initiative" | "sun" | "moon";

export function InstrumentIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: InstrumentIconName }) {
  const c = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false" {...props}>
    {name === "home" && <><path d="M3 8.6 10 3l7 5.6V16a1 1 0 0 1-1 1h-3.5v-4.5h-5V17H4a1 1 0 0 1-1-1z" {...c}/></>}
    {name === "initiatives" && <><rect x="3" y="3.5" width="14" height="4" rx="1" {...c}/><rect x="3" y="9.5" width="14" height="4" rx="1" {...c}/><path d="M5 16.5h10" {...c}/></>}
    {name === "initiative" && <><rect x="3.5" y="3.5" width="13" height="13" rx="2" {...c}/><path d="M7 8h6M7 11h4" {...c}/></>}
    {name === "roadmap" && <><path d="M3 3.5v13" {...c}/><path d="M5.5 5.5h6M8 10h7.5M6.5 14.5h5" {...c} strokeWidth={2.5}/></>}
    {name === "weekly" && <><rect x="3" y="4" width="14" height="13" rx="1.5" {...c}/><path d="M3 8h14M7 2.5v3M13 2.5v3" {...c}/><path d="m7.5 12.3 1.7 1.7 3.3-3.3" {...c}/></>}
    {name === "analysis" && <><path d="M3.5 16.5h13" {...c}/><path d="M6 13.5v-4M10 13.5V5M14 13.5V8" {...c} strokeWidth={2.2}/></>}
    {name === "reporting" && <><path d="M3.5 3.5v13h13" {...c}/><path d="m6 13 3-3 2 1.5 4-5" {...c}/></>}
    {name === "administration" && <><path d="M10 2.5 16 5v4.5c0 3.6-2.5 6.4-6 8-3.5-1.6-6-4.4-6-8V5z" {...c}/><path d="m7.5 10 1.8 1.8 3.2-3.3" {...c}/></>}
    {name === "bell" && <><path d="M5 13.5V9a5 5 0 0 1 10 0v4.5l1.5 2h-13z" {...c}/><path d="M8.5 17.5a1.6 1.6 0 0 0 3 0" {...c}/></>}
    {name === "search" && <><circle cx="8.75" cy="8.75" r="5" {...c}/><path d="m12.5 12.5 4 4" {...c}/></>}
    {name === "demo" && <><path d="M7 3.5h6M8 3.5v4l-4 7a1.5 1.5 0 0 0 1.3 2.2h9.4a1.5 1.5 0 0 0 1.3-2.2l-4-7v-4" {...c}/><path d="M6.5 12h7" {...c}/></>}
    {name === "menu" && <path d="M3 5.5h14M3 10h14M3 14.5h14" {...c}/>}
    {name === "pin" && <><path d="m7 3 6 6M12 4l4 4-3 1-4 4-1 3-4-4 3-1 4-4z" {...c}/></>}
    {name === "event" && <><circle cx="10" cy="10" r="6.5" {...c}/><path d="M10 6.5v4l2.5 1.5" {...c}/></>}
    {name === "evidence" && <><path d="M5 3.5h7l3 3v10H5z" {...c}/><path d="M12 3.5v3h3M7.5 10h5M7.5 13h4" {...c}/></>}
    {name === "decision" && <><path d="M10 3.5v13M4 7h12M6.5 7l-2.5 5h5zM13.5 7l-2.5 5h5z" {...c}/></>}
    {name === "help" && <><circle cx="10" cy="10" r="7" {...c}/><path d="M8 8a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.3v.4" {...c}/><circle cx="10" cy="14" r=".4" {...c} strokeWidth={1.4}/></>}
    {name === "sidebar-collapse" && <><rect x="2.5" y="3.5" width="15" height="13" rx="2" {...c}/><path d="M7.5 3.5v13M13.5 8l-2 2 2 2" {...c}/></>}
    {name === "sidebar-expand" && <><rect x="2.5" y="3.5" width="15" height="13" rx="2" {...c}/><path d="M7.5 3.5v13M11.5 8l2 2-2 2" {...c}/></>}
    {name === "logout" && <><path d="M8 3.5H5a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 5 16.5h3" {...c}/><path d="M12.5 6.5 16 10l-3.5 3.5M16 10H8" {...c}/></>}
    {name === "user" && <><circle cx="10" cy="7" r="3" {...c}/><path d="M4 16.5c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5" {...c}/></>}
    {name === "keyboard" && <><rect x="2.5" y="5" width="15" height="10" rx="1.5" {...c}/><path d="M5.5 8h.01M8.5 8h.01M11.5 8h.01M14.5 8h.01M6.5 12h7" {...c} strokeWidth={1.8}/></>}
    {name === "plug" && <><path d="M7 2.5v4M13 2.5v4M5 6.5h10v3a5 5 0 0 1-10 0z" {...c}/><path d="M10 14.5v3" {...c}/></>}
    {name === "sun" && <><circle cx="10" cy="10" r="3.5" {...c}/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" {...c}/></>}
    {name === "moon" && <path d="M16 12.2A6.5 6.5 0 0 1 7.8 4a6.5 6.5 0 1 0 8.2 8.2z" {...c}/>}
    {name === "check" && <path d="m4.5 10.5 3.5 3.5 7.5-8" {...c} strokeWidth={1.8}/>}
    {name === "chevrons" && <path d="m7 8 3-3 3 3M7 12l3 3 3-3" {...c}/>}
    {name === "chevron-down" && <path d="m6 8 4 4 4-4" {...c}/>}
    {name === "switch" && <><path d="M4 7h11l-3-3M16 13H5l3 3" {...c}/></>}
    {name === "close" && <path d="m5.5 5.5 9 9M14.5 5.5l-9 9" {...c}/>}
    {name === "plus" && <path d="M10 4.5v11M4.5 10h11" {...c}/>}
    {name === "restart" && <><path d="M4 10a6 6 0 1 0 1.8-4.3" {...c}/><path d="M4 3.5v3h3" {...c}/></>}
    {name === "book" && <><path d="M10 5.5c-1.8-1.3-4-1.8-6.5-1.5v11c2.5-.3 4.7.2 6.5 1.5 1.8-1.3 4-1.8 6.5-1.5V4c-2.5-.3-4.7.2-6.5 1.5zM10 5.5v11" {...c}/></>}
  </svg>;
}
