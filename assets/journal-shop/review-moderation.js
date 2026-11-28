const byId=id=>document.getElementById(id);
const form=byId('review-admin-form'),keyInput=byId('review-admin-key'),status=byId('review-admin-status');
const opener=byId('review-admin-open'),queue=byId('review-admin-queue');
const pending=byId('review-pending'),published=byId('review-published'),refresher=byId('review-admin-refresh');
let key='',busy=false;
const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e};
function announce(message,err=false){status.textContent=message;status.dataset.error=String(err)}
async function act(action,id){
 const r=await fetch('/api/journal-reviews',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({action,id})});
 const d=await r.json();
 if(!r.ok)throw Error(d.error||'That action could not be completed.');
 return d;
}
function card(row,live){
 const n=text('article','');n.className='review-card';
 n.append(text('strong',row.rating+'/5 · '+(row.name||'Anonymous reviewer')+(row.free?' · Received free access':'')),text('p',row.comment));
 const actions=text('div','');actions.className='review-actions';
 for(const [label,action] of live?[['Remove','remove']]:[['Publish','publish'],['Reject','reject']]){
  const b=text('button',label);b.type='button';b.className='review-button'+(action==='publish'?'':' secondary');
  b.addEventListener('click',()=>{
   if(action==='remove'&&!confirm('Remove this review from the product page?'))return;
   if(action==='reject'&&!confirm('Discard this review?'))return;
   run(async()=>{await act(action,row.id);await load();announce(action==='publish'?'Review published.':action==='remove'?'Review removed.':'Review discarded.')});
  });
  actions.append(b);
 }
 n.append(actions);return n;
}
async function load(){
 const rows=await act('reviewQueue');
 pending.replaceChildren(...(rows.pending.length?rows.pending.map(r=>card(r,false)):[text('p','No pending reviews.')]));
 published.replaceChildren(...(rows.published.length?rows.published.map(r=>card(r,true)):[text('p','No reviews published.')]));
 queue.hidden=false;form.hidden=true;
}
async function run(fn){
 if(busy)return;busy=true;opener.disabled=true;refresher.disabled=true;announce('Loading…');
 try{await fn()}catch(e){announce(e.message,true)}
 finally{busy=false;opener.disabled=false;refresher.disabled=false}
}
form.addEventListener('submit',e=>{
 e.preventDefault();key=keyInput.value.trim();
 run(async()=>{await load();keyInput.value='';announce('Reviews loaded.')});
});
refresher.addEventListener('click',()=>run(async()=>{await load();announce('Reviews refreshed.')}));
byId('review-admin-lock').addEventListener('click',()=>{
 if(busy)return;key='';keyInput.value='';pending.replaceChildren();published.replaceChildren();queue.hidden=true;form.hidden=false;announce('Moderation locked.');keyInput.focus();
});
opener.disabled=false;
