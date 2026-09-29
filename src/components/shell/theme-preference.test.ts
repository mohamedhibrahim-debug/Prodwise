import {test} from "node:test";
import assert from "node:assert/strict";
import {readTheme,writeTheme,applyTheme,THEME_STORAGE_KEY,THEME_BOOT_SCRIPT} from "./theme-preference.ts";
function memory(){const m=new Map<string,string>();return{getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v);},m};}
test("appearance defaults to light and remembers dark",()=>{const s=memory();assert.equal(readTheme(s),"light");assert.equal(writeTheme(s,"dark"),true);assert.equal(s.m.get(THEME_STORAGE_KEY),"dark");assert.equal(readTheme(s),"dark");writeTheme(s,"light");assert.equal(readTheme(s),"light");});
test("unknown or blocked storage falls back to light without throwing",()=>{const s=memory();s.setItem(THEME_STORAGE_KEY,"sepia");assert.equal(readTheme(s),"light");const throwing={getItem():string|null{throw new Error("blocked");},setItem(){throw new Error("blocked");}};assert.equal(readTheme(throwing),"light");assert.equal(writeTheme(throwing,"dark"),false);assert.equal(readTheme(null),"light");});
test("applying a theme sets the root attribute only for dark",()=>{const root={dataset:{} as DOMStringMap};applyTheme(root,"dark");assert.equal(root.dataset.theme,"dark");applyTheme(root,"light");assert.equal(root.dataset.theme,undefined);});
test("the pre-paint script reads the same key and never throws",()=>{assert.ok(THEME_BOOT_SCRIPT.includes(THEME_STORAGE_KEY));assert.ok(THEME_BOOT_SCRIPT.startsWith("try{"));assert.ok(THEME_BOOT_SCRIPT.includes('dataset.theme="dark"'));});
