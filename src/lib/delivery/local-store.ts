import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { EMPTY_STATE, type DeliveryState } from "./types.ts";
import { DeliveryError } from "./model.ts";

/** Local demo durability only. Never used in Vercel/multiple instances. A single
 * exclusive lock protects the read/validate/write transaction and temp rename. */
export class LocalDeliveryStore {
  readonly path:string;
  constructor(path: string) { this.path=path; }
  async read():Promise<DeliveryState> {
    try { const data:unknown=JSON.parse(await readFile(this.path,"utf8"));
      if (!data || typeof data!=="object" || !("schema" in data) || data.schema!==1 || !("facts" in data) || !Array.isArray(data.facts) || !("events" in data) || !Array.isArray(data.events) || !("reviews" in data) || !Array.isArray(data.reviews)) throw new Error("Invalid delivery data shape");
      return data as DeliveryState;
    } catch(error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(EMPTY_STATE); throw error; }
  }
  /** Shares the delivery mutex without rewriting delivery state. */
  async withReadLock<T>(read:(state:DeliveryState)=>T):Promise<T> {
    await mkdir(dirname(this.path),{recursive:true});
    const lockPath=`${this.path}.lock`;
    let lock;
    for(let attempt=0;attempt<11;attempt++){
      try{lock=await open(lockPath,"wx");break;}catch(error){
        if((error as NodeJS.ErrnoException).code!=="EEXIST")throw error;
        if(attempt===10)throw new DeliveryError("BUSY","Another delivery change is saving. Try again.");
        await new Promise(resolve=>setTimeout(resolve,25));
      }
    }
    if(!lock)throw new DeliveryError("BUSY","Another delivery change is saving. Try again.");
    try{return read(await this.read());}finally{await lock.close();await unlink(lockPath);}
  }
  async transaction(change:(state:DeliveryState)=>Promise<DeliveryState>,commit?:(next:DeliveryState)=>void):Promise<DeliveryState> {
    await mkdir(dirname(this.path),{recursive:true}); const lockPath=`${this.path}.lock`;
    let lock;
    for (let attempt=0;attempt<11;attempt++) {
      try { lock=await open(lockPath,"wx"); break; } catch(error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        if (attempt===10) throw new DeliveryError("BUSY","Another delivery change is saving. Try again.");
        await new Promise(resolve=>setTimeout(resolve,25));
      }
    }
    if (!lock) throw new DeliveryError("BUSY","Another delivery change is saving. Try again.");
    const temp=`${this.path}.${randomUUID()}.tmp`;
    try { const next=await change(await this.read()); if(commit){commit(next);return next;} const file=await open(temp,"wx");
      try { await file.writeFile(JSON.stringify(next),"utf8"); await file.sync(); } finally { await file.close(); }
      await rename(temp,this.path); return next;
    } finally { await unlink(temp).catch(()=>undefined); await lock.close(); await unlink(lockPath); }
  }
}
