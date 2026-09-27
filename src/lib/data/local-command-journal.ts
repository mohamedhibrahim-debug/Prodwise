import {existsSync,readFileSync,writeFileSync,renameSync,unlinkSync,mkdirSync,openSync,fsyncSync,closeSync} from 'node:fs';
import {dirname,resolve,relative,isAbsolute} from 'node:path';
import {randomUUID} from 'node:crypto';
interface Entry {path:string;content:string}
function replace(path:string,content:string){
 mkdirSync(dirname(path),{recursive:true});const temp=`${path}.${randomUUID()}.tmp`;
 const fd=openSync(temp,'wx');try{writeFileSync(fd,content,'utf8');fsyncSync(fd);}finally{closeSync(fd);}renameSync(temp,path);
}
function validate(root:string,entries:Entry[]){
 if(entries.length!==2)throw new Error('Invalid local command journal.');
 for(const entry of entries){const rel=relative(resolve(root),resolve(entry.path));if(!rel||rel.startsWith('..')||isAbsolute(rel)||typeof entry.content!=='string')throw new Error('Invalid local command destination.');JSON.parse(entry.content);}
}
/** Single local Node writer only. A durable intent is rolled forward before any
 * product read. Hosted execution uses PostgreSQL transactions instead. */
export function recoverLocalCommand(root:string):void{
 const journal=resolve(root,'pending-product-command.json');if(!existsSync(journal))return;
 const entries=JSON.parse(readFileSync(journal,'utf8')) as Entry[];validate(root,entries);
 for(const entry of entries)replace(entry.path,entry.content);unlinkSync(journal);
}
export function commitLocalCommand(root:string,entries:Entry[]):void{
 recoverLocalCommand(root);validate(root,entries);
 const journal=resolve(root,'pending-product-command.json');replace(journal,JSON.stringify(entries));
 recoverLocalCommand(root);
}
