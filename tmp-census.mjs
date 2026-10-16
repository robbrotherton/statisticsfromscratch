import {chromium} from 'playwright';
import {readdirSync} from 'node:fs';
const pages=readdirSync('docs').filter(f=>f.endsWith('.html'));
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:900}});
for (const f of pages){
  await p.goto('http://localhost:8767/'+f,{waitUntil:'networkidle'}).catch(()=>{});
  await p.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=700){scrollTo(0,y);await new Promise(r=>setTimeout(r,60));}});
  await p.waitForTimeout(500);
  const r=await p.evaluate(()=>[...document.querySelectorAll('.dg-legend,.dpe-legend')].filter(g=>g.childElementCount).map(g=>{
    const fig=g.closest('[id^=fig-],[id^=act-],.callout,figure'); const mount=g.closest('[data-figure-id],[id]');
    return (fig&&fig.id||'?')+' / '+(g.closest('.interactive-figure-mount')?.dataset?.figureId||g.closest('[id]')?.id||'')+' : '+[...g.querySelectorAll('text')].map(t=>t.textContent).join(' | ');}));
  if(r.length) console.log(f, JSON.stringify(r));
}
await b.close();
