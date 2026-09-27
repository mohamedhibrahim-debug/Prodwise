/** Display-only helpers are safe in client components; no state or provider imports. */
export function displayDate(date:string|null|undefined):string{return date?new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(`${date}T00:00:00Z`)):"Unknown";}
