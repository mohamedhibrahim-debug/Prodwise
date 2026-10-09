const { parentPort, workerData } = require('node:worker_threads');
const { Readable } = require('node:stream');
const ExcelJS = require('exceljs');
const unzipper = require('unzipper');
const LIMIT = 300_000_000;
async function read() {
  if(typeof workerData!=='string'||workerData.length>Math.ceil(25_000_000/3)*4)throw Error('Excel worker input exceeds the safe file-size limit or is invalid.');
  const bytes = Buffer.from(workerData,'base64');
  const archive = await unzipper.Open.buffer(bytes);
  if (archive.files.length > 256 || new Set(archive.files.map(file=>file.path)).size!==archive.files.length) throw Error('Excel archive has too many or duplicate entries.');
  let declared=0, expanded=0;
  for (const file of archive.files) {
    declared+=file.uncompressedSize;
    if (!Number.isSafeInteger(declared) || declared>LIMIT || file.path.includes('..') || file.isEncrypted)
      throw Error('Excel archive exceeds the safe expanded-size limit or is unsupported.');
  }
  // Verify actual inflation too: an archive's size metadata is not a security boundary.
  for (const file of archive.files) {
    const stream=file.stream();let actual=0;
    for await(const chunk of stream){
      expanded+=chunk.length;actual+=chunk.length;
      if(expanded>LIMIT || actual>file.uncompressedSize){stream.destroy();throw Error('Excel archive exceeds the safe expanded-size limit.');}
    }
    if(actual!==file.uncompressedSize)throw Error('Excel archive is incomplete.');
  }
  const required=['Transaction Reference','Transaction Date','Transaction Type','Transaction Status','Amount'];
  const records=[];let matched=false,sheets=0,totalRows=0;
  const workbook=new ExcelJS.stream.xlsx.WorkbookReader(Readable.from([bytes]),{worksheets:'emit',sharedStrings:'cache',styles:'cache',hyperlinks:'ignore'});
  // The pinned ExcelJS 4.4 stream parser expects metadata before worksheets.
  // Feed its parsers centrally indexed ZIP entries, also supporting data-descriptor exports.
  const metadata=archive.files.find(file=>file.path==='xl/workbook.xml');
  if(!metadata)throw Error('Excel workbook metadata is missing.');
  await workbook._parseWorkbook(metadata.stream());
  const strings=archive.files.find(file=>file.path==='xl/sharedStrings.xml');
  if(strings)for await(const unused of workbook._parseSharedStrings(strings.stream())){void unused;}
  const styles=archive.files.find(file=>file.path==='xl/styles.xml');
  if(styles)await workbook._parseStyles(styles.stream());
  const rels=archive.files.find(file=>file.path==='xl/_rels/workbook.xml.rels');
  if(rels)await workbook._parseRels(rels.stream());
  function* worksheets(){
    for(const entry of archive.files){
      const match=entry.path.match(/^xl\/worksheets\/sheet(\d+)\.xml$/);
      if(match)for(const parsed of workbook._parseWorksheet(entry.stream(),match[1]))yield parsed.value;
    }
  }
  for(const sheet of worksheets()){
    if(++sheets>20)throw Error('Excel report has too many sheets.');
    let columns=null;
    for await(const row of sheet){
      if(++totalRows>150_020||row.number>150_001||row.cellCount>256)throw Error('Import at most 150,000 rows and 256 columns at a time.');
      if(row.number===1){
        const headers=[];row.eachCell({includeEmpty:true},cell=>headers.push(cell.text.trim()));
        if(!required.every(name=>headers.includes(name)))continue;
        if(matched)throw Error('Multiple PGW transaction sheets found. Import one report at a time.');
        if(required.some(name=>headers.filter(value=>value===name).length!==1))throw Error('Excel has duplicate reporting columns.');
        matched=true;columns=required.map(name=>headers.indexOf(name)+1);continue;
      }
      if(!columns||!row.hasValues)continue;
      if(records.length>=150_000)throw Error('Import at most 150,000 rows at a time.');
      const values=columns.map(column=>{
        const value=row.getCell(column).value;
        if(value==null)return '';
        if(value instanceof Date)return value.toISOString().slice(0,10);
        if(typeof value==='string'||typeof value==='number'){
          if(String(value).length>1000)throw Error('A reporting value is too long.');
          return String(value);
        }
        throw Error('Reporting columns must contain plain values, not formulas or linked cells.');
      });
      records.push(Object.fromEntries(required.map((name,index)=>[name,values[index]])));
    }
  }
  if(!matched)throw Error('No PGW transaction sheet with the required columns was found.');
  return records;
}
read().then(records=>parentPort.postMessage({records})).catch(error=>parentPort.postMessage({error:error instanceof Error?error.message:'Could not read Excel report.'}));
