import fs from 'node:fs/promises';
const endpoint=new URL(process.env.JOURNAL_CHECKOUT_URL||'');
if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.pathname!=='/api/journal-checkout')throw Error('Set JOURNAL_CHECKOUT_URL to the HTTPS checkout API.');
const token=process.env.JOURNAL_ADMIN_TOKEN;
if(!token||token.length<32)throw Error('Set the private JOURNAL_ADMIN_TOKEN environment variable.');
let offset=0,text='';
do{
 const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({action:'export',offset}),redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!r.ok||!(r.headers.get('content-type')||'').includes('text/csv'))throw Error('CSV export failed ('+r.status+'). No backup file was written.');
 const csv=await r.text();text+=offset?csv.slice(csv.indexOf('\r\n')+2):csv;
 const next=Number(r.headers.get('x-next-offset')||0);if(next&&next<=offset)throw Error('Could not complete the export.');offset=next;
}while(offset);
const file='journal-orders-'+new Date().toISOString().replace(/[:.]/g,'-')+'.csv';
await fs.writeFile(file,text,{mode:0o600,flag:'wx'});console.log(file);
