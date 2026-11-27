import inviteHandler from '../lib/journal-invite.js';
import {createHash,timingSafeEqual} from 'node:crypto';
const SKU='ncfm-baby-journal',REF='ncfm-baby-journal-v17',AMOUNT='9.90',CURRENCY='USD';
const orderRE=/^[A-Z0-9]{12,24}$/,secretRE=/^[0-9a-f]{64}$/;
class HttpError extends Error{constructor(status,message){super(message);this.status=status}}
const fail=(status,message)=>{throw new HttpError(status,message)};
const digest=x=>createHash('sha256').update(x).digest('hex');
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const unavailable='Checkout recovery is temporarily unavailable. If you already paid, do not pay again.';
function settings(origin){
 const env=process.env,preview=env.VERCEL_ENV==='preview';
 // Never let a Preview inherit real payment mode; this branch is for sandbox testing.
 const mode=preview?'sandbox':(env.JOURNAL_PAYPAL_MODE||'sandbox');
 if(!['live','sandbox'].includes(mode))fail(503,unavailable);
 const live=mode==='live';
 if(live&&env.JOURNAL_LIVE_ENABLED!=='true')fail(503,'Live checkout is not enabled.');
 const name=live?'LIVE':'SANDBOX';
 const client=env['PAYPAL_'+name+'_CLIENT_ID']||(!live&&env.PAYPAL_CLIENT_ID),secret=env['PAYPAL_'+name+'_CLIENT_SECRET']||env['PAYPAL_'+name+'_CLIENT_SECRET_KEY']||(!live&&env.PAYPAL_CLIENT_SECRET_KEY);
 const merchant=env['PAYPAL_'+name+'_MERCHANT_ID'];
 let editor,store;
 try{
  if(preview){
   const hosts=[env.VERCEL_URL,env.VERCEL_BRANCH_URL].filter(h=>typeof h==='string'&&/^[a-z0-9.-]+\.vercel\.app$/i.test(h));
   const valid=hosts.find(h=>'https://'+h===origin)||hosts[0];
   if(!valid)fail(503,unavailable);
   editor=new URL('https://'+valid+'/shop/my-babys-little-days');
  }else editor=new URL(env.JOURNAL_EDITOR_URL);
  store=new URL(env.JOURNAL_REDIS_URL||env.UPSTASH_REDIS_REST_KV_REST_API_URL);
 }catch{fail(503,unavailable)}
 const storeToken=env.JOURNAL_REDIS_TOKEN||env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;
 if(preview&&(!client||!secret))fail(503,'PayPal Sandbox is not connected for this Preview yet. No payment was attempted.');
 if(!client||!secret||(live&&!merchant)||!storeToken||editor.protocol!=='https:'||store.protocol!=='https:'||editor.username||editor.password||store.username||store.password)fail(503,unavailable);
 return {mode,live,client,secret,merchant,editor,store:store.href.replace(/\/$/,''),storeToken,base:'https://api-m.'+(live?'':'sandbox.')+'paypal.com'};
}
async function redis(c,cmd){
 const r=await fetch(c.store,{method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+c.storeToken,'Content-Type':'application/json'},body:JSON.stringify(cmd)});
 const j=await r.json().catch(()=>({}));if(!r.ok||j.error||!('result'in j))fail(503,unavailable);return j.result;
}
const orderKey=(c,id)=>'ncfm:journal:'+c.mode+':order:'+id;
const orderIndex=c=>'ncfm:journal:'+c.mode+':orders';
const newRowScript="if redis.call('HEXISTS',KEYS[1],'keyHash')==1 then return redis.call('HGET',KEYS[1],'keyHash') end redis.call('HSET',KEYS[1],'keyHash',ARGV[1],'createdAt',ARGV[2],'status','CREATED','orderId',ARGV[3],'product',ARGV[4],'amount',ARGV[5],'currency',ARGV[6]); redis.call('ZADD',KEYS[2],ARGV[7],ARGV[3]); return ARGV[1]";
const paidScript="local id=redis.call('HGET',KEYS[1],'captureId'); if id and id~=ARGV[1] then return 0 end redis.call('HSET',KEYS[1],'status','PAID','captureId',ARGV[1],'paidAt',ARGV[2]); return 1";
const eventScript="if redis.call('HGET',KEYS[1],'status')~='PAID' then return -1 end if redis.call('HSETNX',KEYS[2],ARGV[1],'1')==1 then redis.call('HINCRBY',KEYS[1],'downloadRequests',1); redis.call('HSET',KEYS[1],'lastDownloadRequestAt',ARGV[2]); return 1 end return 0";
let cache=null;
async function paypalToken(c){
 if(cache&&cache.client===c.client&&cache.base===c.base&&cache.until>Date.now())return cache.token;
 const r=await fetch(c.base+'/v1/oauth2/token',{method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:'Basic '+Buffer.from(c.client+':'+c.secret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
 const j=await r.json().catch(()=>({}));if(!r.ok||!j.access_token)fail(503,'PayPal is unavailable. Try again without starting a second order.');
 cache={client:c.client,base:c.base,token:j.access_token,until:Date.now()+Math.max(0,(Number(j.expires_in||0)-90)*1000)};
 return cache.token;
}
async function paypal(c,path,{method='GET',body,idempotency}={}){
 const headers={Authorization:'Bearer '+await paypalToken(c),'Content-Type':'application/json',Prefer:'return=representation'};
 if(idempotency)headers['PayPal-Request-Id']=idempotency;
 const r=await fetch(c.base+'/v2/checkout/orders'+path,{method,headers,signal:AbortSignal.timeout(15000),body:body===undefined?undefined:JSON.stringify(body)});
 const j=await r.json().catch(()=>({}));
 if(!r.ok)fail(502,'PayPal could not confirm the order. Use Recover order before paying again.');
 return j;
}
const amountOK=a=>a?.currency_code===CURRENCY&&a?.value===AMOUNT;
function unitOK(j,c,key){
 const units=j.purchase_units;
 if(units?.length!==1)return false;
 const u=units[0];
 return u.reference_id===REF&&u.custom_id===digest(key)&&(!c.merchant||u.payee?.merchant_id===c.merchant)&&amountOK(u.amount);
}
function paidCapture(j){
 const captures=j.purchase_units?.[0]?.payments?.captures;
 if(j.status!=='COMPLETED'||captures?.length!==1)return null;
 const a=captures[0];return a.status==='COMPLETED'&&amountOK(a.amount)&&orderRE.test(a.id||'')?a:null;
}
const toMap=items=>Array.isArray(items)?Object.fromEntries(items.reduce((out,v,i)=>{if(i%2===0)out.push([v,items[i+1]]);return out},[])):items||{};
const iso=x=>typeof x==='string'&&!Number.isNaN(Date.parse(x))?new Date(x).toISOString():new Date().toISOString();
function urlFor(c,kind){const u=new URL(c.editor);u.searchParams.set('journal',kind);return u.href}
export default async function handler(req,res){
 if(req.query?.journalRoute==='invite')return inviteHandler(req,res);
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 // Readiness authenticates to PayPal and checks the ledger without creating an order.
 if(req.method==='GET'&&['preview','production'].includes(process.env.VERCEL_ENV)){
  const preview=process.env.VERCEL_ENV==='preview';
  try{
   const c=settings();
   if(!preview&&req.headers?.host!==c.editor.host)return res.status(404).json({error:'Not found.'});
   await Promise.all([redis(c,['PING']),paypalToken(c)]);
   return res.status(200).json({checkout:'ready',mode:c.mode,realMoney:c.live});
  }catch(e){return res.status(e.status||503).json({checkout:'not-ready',error:preview&&e instanceof HttpError?e.message:unavailable});}
 }
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'});
 try{
  const c=settings(req.headers?.origin),b=req.body||{},action=b.action;
  if(action==='export'){
   const auth=req.headers?.authorization||'';
   const admin=process.env.JOURNAL_ADMIN_TOKEN;
   if(!admin||admin.length<32||!same(auth,'Bearer '+admin))fail(403,'Not allowed.');
   const start=Math.max(0,Math.min(1000000,Number.isSafeInteger(b.offset)?b.offset:0));
   const ids=await redis(c,['ZREVRANGE',orderIndex(c),start,start+99]);
   const fields=['orderId','product','status','amount','currency','captureId','createdAt','paidAt','downloadRequests','lastDownloadRequestAt'];
   const all=await Promise.all(ids.map(id=>redis(c,['HMGET',orderKey(c,id),...fields])));
   const csvCell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
   res.setHeader('Content-Type','text/csv; charset=utf-8');
   res.setHeader('Content-Disposition','attachment; filename="journal-orders-'+c.mode+'.csv"');res.setHeader('X-Next-Offset',ids.length===100?String(start+100):'');
   return res.status(200).send(fields.join(',')+'\r\n'+all.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n');
  }
  if(req.headers?.origin!==c.editor.origin)fail(403,'Open checkout from the hosted journal.');
  if(action==='config'){await Promise.all([redis(c,['PING']),paypalToken(c)]);return res.status(200).json({mode:c.mode})}
  if(!['create','capture','status','download'].includes(action))fail(400,'Unknown checkout action.');
  const key=b.key;if(typeof key!=='string'||!secretRE.test(key))fail(400,'Order recovery key is missing.');
  const hash=digest(key);
  if(action==='create'){
   if(typeof b.attempt!=='string'||!secretRE.test(b.attempt))fail(400,'Invalid checkout attempt.');
   await redis(c,['PING']);
   const j=await paypal(c,'',{method:'POST',idempotency:digest('create:'+hash+':'+b.attempt).slice(0,38),body:{
    intent:'CAPTURE',purchase_units:[{reference_id:REF,custom_id:hash,description:"My Baby's Little Days - digital journal",amount:{currency_code:CURRENCY,value:AMOUNT}}],
    payment_source:{paypal:{experience_context:{shipping_preference:'NO_SHIPPING',user_action:'PAY_NOW',return_url:urlFor(c,'return'),cancel_url:urlFor(c,'cancel')}}}
   }});
   const id=j.id,link=j.links?.find(x=>x.rel==='payer-action'||x.rel==='approve')?.href;
   const allowed=c.live?'www.paypal.com':'www.sandbox.paypal.com';
   let approval;try{approval=new URL(link)}catch{}
   if(!orderRE.test(id||'')||!approval||approval.protocol!=='https:'||approval.hostname!==allowed||approval.port||approval.username||approval.password)fail(502,'PayPal did not open an approval page.');
   const now=new Date();const owner=await redis(c,['EVAL',newRowScript,2,orderKey(c,id),orderIndex(c),hash,now.toISOString(),id,SKU,AMOUNT,CURRENCY,now.getTime()]);
   if(!same(owner,hash))fail(409,'This order could not be linked. Do not pay until it is checked.');
   return res.status(200).json({id,approval:approval.href});
  }
  const id=b.orderId;if(typeof id!=='string'||!orderRE.test(id))fail(400,'Invalid order number.');
  const rowKey=orderKey(c,id),row=toMap(await redis(c,['HGETALL',rowKey]));
  if(!same(row.keyHash,hash))fail(404,'This order is not available with that recovery key.');
  if(action==='download'){
   if(typeof b.eventId!=='string'||!secretRE.test(b.eventId))fail(400,'Invalid download request.');
   const n=await redis(c,['EVAL',eventScript,2,rowKey,rowKey+':download-events',b.eventId,new Date().toISOString()]);
   if(Number(n)===-1)fail(409,'Payment is not verified for this order.');
   return res.status(200).json({recorded:true});
  }
  let j=await paypal(c,'/'+id);
  if(!unitOK(j,c,key))fail(409,'Order details do not match this journal. Do not pay again.');
  if(action==='capture'&&j.status==='APPROVED'){
   try{await paypal(c,'/'+id+'/capture',{method:'POST',body:{},idempotency:digest('capture:'+id+':'+c.mode).slice(0,38)})}catch(e){/* Reconcile possible lost capture response before reporting status. */}
   j=await paypal(c,'/'+id);
   if(!unitOK(j,c,key))fail(409,'Payment details did not match this order. Do not pay again.');
  }
  const capture=paidCapture(j);
  if(capture){
   const ok=await redis(c,['EVAL',paidScript,1,rowKey,capture.id,iso(capture.create_time)]);
   if(Number(ok)!==1)fail(409,'This payment needs a manual check. Do not pay again.');
   return res.status(200).json({paid:true,orderId:id});
  }
  const captureStatus=j.purchase_units?.[0]?.payments?.captures?.[0]?.status;
  return res.status(200).json({paid:false,canFinish:j.status==='APPROVED'&&!captureStatus,pending:['APPROVED','COMPLETED','VOIDED'].includes(j.status)||!!captureStatus});
 }catch(e){return res.status(e.status||503).json({error:e instanceof HttpError?e.message:unavailable})}
}
