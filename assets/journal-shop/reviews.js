const form=document.getElementById('journal-review-form');
const list=document.getElementById('published-journal-reviews');
const state=document.getElementById('journal-review-list-status');
const status=document.getElementById('journal-review-form-status');
const btn=document.getElementById('journal-review-submit');
const endpoint='/api/journal-reviews';
const el=(tag,text,className)=>{
 const e=document.createElement(tag);e.textContent=text;if(className)e.className=className;return e;
};
function card(review){
 const node=document.createElement('article');node.className='review-card';
 const head=document.createElement('header');
 const stars=el('span','★'.repeat(review.rating)+'☆'.repeat(5-review.rating),'review-stars');
 stars.setAttribute('aria-label',review.rating+' out of 5 stars');stars.setAttribute('role','img');
 head.append(stars,el('strong',review.name||'Anonymous reviewer'));
 if(review.free)head.append(el('small','Received free access','review-badge'));
 node.append(head,el('p',review.comment));return node;
}
async function readReviews(){
 try{
  const r=await fetch(endpoint,{headers:{Accept:'application/json'}});
  if(!r.ok)throw Error();
  const data=await r.json();
  list.replaceChildren(...data.reviews.map(card));
  state.textContent=data.reviews.length?'':'No reviews yet. You can be the first.';
 }catch{state.textContent='Reviews couldn’t load right now.'}
}
form.addEventListener('submit',async event=>{
 event.preventDefault();
 const d=new FormData(form),comment=String(d.get('comment')||'').trim();
 status.removeAttribute('data-error');
 if(comment.length<5){status.textContent='Please write at least 5 characters.';status.dataset.error='true';form.elements.comment.focus();return}
 btn.disabled=true;status.textContent='Submitting your review…';
 try{
  const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
   action:'submit',rating:Number(d.get('rating')),comment,name:String(d.get('name')||'').trim(),free:d.has('free'),consent:d.has('consent'),website:String(d.get('website')||'')
  })});
  const data=await r.json();
  if(r.status!==201||!data.received)throw Error(data.error||'Your review couldn’t be submitted. Please try again.');
  form.reset();status.textContent='Thanks for sharing your experience. Your review is awaiting moderation.';
 }catch(e){status.textContent=e instanceof TypeError?'Your review couldn’t be sent. Please try again.':e.message;status.dataset.error='true'}
 finally{btn.disabled=false}
});
btn.disabled=false;
readReviews();
