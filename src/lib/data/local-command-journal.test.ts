import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {commitLocalCommand,recoverLocalCommand} from './local-command-journal.ts';
test('creation journal recovers both canonical stores after interruption and is repeatable',()=>{
 const root=mkdtempSync(join(tmpdir(),'prodwise-command-'));
 try{const entries=[{path:join(root,'product.json'),content:'{"initiative":"new"}'},{path:join(root,'delivery.json'),content:'{"owner":"assigned"}'}];
 writeFileSync(join(root,'pending-product-command.json'),JSON.stringify(entries));writeFileSync(entries[1]!.path,entries[1]!.content);
 recoverLocalCommand(root);recoverLocalCommand(root);assert.equal(readFileSync(entries[0]!.path,'utf8'),entries[0]!.content);
 commitLocalCommand(root,entries);assert.equal(readFileSync(entries[1]!.path,'utf8'),entries[1]!.content);
 assert.throws(()=>commitLocalCommand(root,[entries[0]!,{path:join(root,'..','escape.json'),content:'{}'}]),/destination/);
 }finally{if(!root.startsWith(join(tmpdir(),'prodwise-command-')))throw Error('Unexpected test path');rmSync(root,{recursive:true,force:true});}
});
