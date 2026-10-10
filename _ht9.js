const { chromium, devices } = require('playwright');
(async()=>{const b=await chromium.launch();const c=await b.newContext({...devices['iPhone 14']});const p=await c.newPage();
await p.goto('http://localhost:8931/');await p.waitForTimeout(1500);
await p.evaluate(()=>{credits=1194518;bet=435000;refresh()});await p.waitForTimeout(300);
const r=await p.evaluate(()=>{const e=document.querySelector('#betMax'),cs=getComputedStyle(e),rc=e.getBoundingClientRect();return {text:e.textContent,font:cs.fontSize,color:cs.color,w:Math.round(rc.width),sw:e.scrollWidth,cw:e.clientWidth,overflow:cs.overflow,textOverflow:cs.textOverflow,maxW:cs.maxWidth,ws:cs.whiteSpace}});
console.log(JSON.stringify(r));
await p.locator('.bet-panel, .controls').first().scrollIntoViewIfNeeded();
const box=await p.locator('#bet').boundingBox();
await p.screenshot({path:'/tmp/betline.png',clip:{x:0,y:Math.max(0,box.y-70),width:390,height:150}});await b.close()})();
