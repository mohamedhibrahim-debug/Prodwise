import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
let active = false;
export function excelRecords(bytes:Uint8Array):Promise<Record<string,string>[]> {
  if(!ExcelJS.stream?.xlsx)throw Error('Excel support is unavailable.');
  if(active)throw Error('Another Excel report is processing. Please retry shortly.');
  active=true;
  return new Promise((resolve,reject)=>{
    let worker:Worker;
    try {worker=new Worker(join(process.cwd(),'scripts/reporting/xlsx-worker.cjs'),{
      workerData:bytes,execArgv:[],resourceLimits:{maxOldGenerationSizeMb:512,maxYoungGenerationSizeMb:64},
    });} catch(e){active=false;reject(e);return;}
    let settled=false;
    const timer=setTimeout(async()=>{settled=true;await worker.terminate();reject(Error('Excel processing exceeded two minutes. Export a smaller period.'));},120_000);
    worker.once('message',async message=>{
      settled=true;clearTimeout(timer);await worker.terminate();
      if(message.error)reject(Error(message.error));else resolve(message.records);
    });
    worker.once('error',async()=>{settled=true;clearTimeout(timer);await worker.terminate();reject(Error('Excel processing exceeded safe resource limits or the workbook is damaged.'));});
    worker.once('exit',()=>{active=false;clearTimeout(timer);if(!settled)reject(Error('Excel processing stopped. Export a smaller period.'));});
  });
}
