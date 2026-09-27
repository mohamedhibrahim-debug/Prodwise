import {createHash} from 'node:crypto';
export const sha256Utf8=(text:string)=>createHash('sha256').update(text,'utf8').digest('hex');
export const normalizeSubmission=(text:string)=>text.replace(/\r\n?/g,'\n').normalize('NFC');
export const hasLoneSurrogate=(text:string)=>/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text);
function splitsSurrogate(text:string,offset:number){return offset>0&&offset<text.length&&text.charCodeAt(offset-1)>=0xd800&&text.charCodeAt(offset-1)<=0xdbff&&text.charCodeAt(offset)>=0xdc00&&text.charCodeAt(offset)<=0xdfff;}
export function verifyAnchor(text:string,a:{start:number;end:number;quote:string},expectedSha?:string){return !hasLoneSurrogate(text)&&Number.isInteger(a.start)&&Number.isInteger(a.end)&&a.start>=0&&a.end<=text.length&&a.start<a.end&&!splitsSurrogate(text,a.start)&&!splitsSurrogate(text,a.end)&&(!expectedSha||sha256Utf8(text)===expectedSha)&&text.slice(a.start,a.end)===a.quote;}
export function locateQuote(text:string,quote:string,hint=0){if(!quote)return null;const offsets:number[]=[];for(let at=text.indexOf(quote);at>=0;at=text.indexOf(quote,at+1))offsets.push(at);const start=offsets.sort((a,b)=>Math.abs(a-hint)-Math.abs(b-hint)||a-b)[0];if(start===undefined)return null;const a={start,end:start+quote.length,quote};return verifyAnchor(text,a)?a:null;}
