/** Display-only helpers are safe in client components; no state or provider imports. */
export function displayDate(date:string|null|undefined):string{return date?new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(`${date}T00:00:00Z`)):"Unknown";}
/**
 * A delivery fact's date as a person should read it. "Unknown" only when someone recorded that
 * the date is unknown; "Not recorded" when nothing was entered (absence is not a statement).
 */
export function factDate(fact:{state?:string;value:{date:string|null;unknown?:true;dateUnknown?:true}}|null|undefined):string{
 if(!fact||fact.state==='RETRACTED')return "Not recorded";
 if(fact.value.date)return displayDate(fact.value.date);
 return fact.value.unknown||fact.value.dateUnknown?"Unknown":"Not recorded";
}
/** Evidence locators as people read them; system character offsets become a plain phrase. */
export function displayLocator(locator:string|null|undefined):string|null{
 if(!locator)return null;
 return /^UTF16 \d+\D\d+$/.test(locator.trim())?"quoted passage in the saved text":locator;
}
