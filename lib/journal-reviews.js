import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {isIP} from 'node:net';

const ORIGIN='https://www.citymomnotes.com';
const NS='ncfm:journal:reviews:v1:';
const PENDING=NS+'pending', PUBLIC=NS+'published', PUBLIC_INDEX=NS+'published-index';
const TTL=90*86400;
const ID=/^[a-f0-9-]{36}$/;
const HEX=/^[a-f0-9]{64}$/;
const unavailable='Reviews are temporarily unavailable. Please try again.';
const hash=x=>createHash('sha256').update(x).digest('hex');
const clean=x=>x.normalize('NFC').replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g,'').trim();
const itemKey=id=>NS+'item:'+id;

const SUBMIT=`
redis.call('ZREMRANGEBYSCORE',KEYS[1],'-inf',ARGV[5])
if redis.call('ZCARD',KEYS[1]) >= 250 then return 0 end
if tonumber(redis.call('GET',KEYS[3]) or '0') >= 5 or tonumber(redis.call('GET',KEYS[4]) or '0') >= 75 then return 0 end
if redis.call('INCR',KEYS[3]) == 1 then redis.call('EXPIRE',KEYS[3],86400) end
if redis.call('INCR',KEYS[4]) == 1 then redis.call('EXPIRE',KEYS[4],3600) end
redis.call('SET',KEYS[2],ARGV[3],'EX',ARGV[4])
redis.call('ZADD',KEYS[1],ARGV[2],ARGV[1])
return 1`;
const MODERATE=`
if ARGV[1] == 'remove' then
 local n=redis.call('HDEL',KEYS[3],ARGV[2]); redis.call('ZREM',KEYS[4],ARGV[2]); return n
end
local row=redis.call('GET',KEYS[2])
if not row then redis.call('ZREM',KEYS[1],ARGV[2]); return 0 end
if ARGV[1] == 'publish' then
 if redis.call('ZCARD',KEYS[4]) >= 500 then return -1 end
 redis.call('HSET',KEYS[3],ARGV[2],row)
 redis.call('ZADD',KEYS[4],ARGV[3],ARGV[2])
end
redis.call('DEL',KEYS[2]); redis.call('ZREM',KEYS[1],ARGV[2])
return 1`;
const LIST_PUBLIC=`
local ids=redis.call('ZREVRANGE',KEYS[1],0,ARGV[1])
local rows={}
for _,id in ipairs(ids) do
 local row=redis.call('HGET',KEYS[2],id)
 if row then table.insert(rows,row) end
end
return rows`;

function config(){
 const e=process.env;
 const url=new URL(e.JOURNAL_REDIS_URL||e.UPSTASH_REDIS_REST_KV_REST_API_URL);
 const token=e.JOURNAL_REDIS_TOKEN||e.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;
 const digest=e.JOURNAL_REVIEW_ADMIN_HASH;
 if(url.protocol!=='https:'||url.username||url.password||!token||!HEX.test(digest||''))throw Error();
 return {url,token,digest};
}
async function redis(c,cmd){
 const r=await fetch(c.url,{method:'POST',signal:AbortSignal.timeout(8000),headers:{Authorization:'Bearer '+c.token,'Content-Type':'application/json'},body:JSON.stringify(cmd)});
 const j=await r.json();
 if(!r.ok||j.error||!Object.hasOwn(j,'result'))throw Error();
 return j.result;
}
function parseRows(result){
 return (Array.isArray(result)?result:[]).flatMap(raw=>{
  if(typeof raw!=='string')return [];
  try{
   const {id,rating,comment,name,free,createdAt}=JSON.parse(raw);
   return ID.test(id)&&Number.isInteger(rating)&&rating>=1&&rating<=5&&typeof comment==='string'&&typeof name==='string'
    ?[{id,rating,comment,name,free:free===true,createdAt}]:[];
  }catch{return []}
 });
}
function authorized(req,c){
 const v=req.headers.authorization;
 if(typeof v!=='string'||!/^Bearer [a-zA-Z0-9_-]{32}$/.test(v))return false;
 return timingSafeEqual(Buffer.from(hash(v.slice(7)),'hex'),Buffer.from(c.digest,'hex'));
}
const publicRow=({rating,comment,name,free,createdAt})=>({rating,comment,name,free,createdAt});

export default async function reviewHandler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(process.env.VERCEL_ENV!=='production')return res.status(403).json({error:'Reviews are available on the live site.'});
 if(req.method!=='GET'&&req.method!=='POST')return res.status(405).json({error:'Method not allowed.'});
 if(req.method==='POST'&&req.headers.origin!==ORIGIN)return res.status(403).json({error:'Open the form on City Mom Notes to continue.'});
 try{
  const c=config();
  if(req.method==='GET'){
   const rows=parseRows(await redis(c,['EVAL',LIST_PUBLIC,2,PUBLIC_INDEX,PUBLIC,29]));
   return res.status(200).json({reviews:rows.map(publicRow)});
  }
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))return res.status(415).json({error:'Send your review from the form.'});
  const b=req.body;
  if(!b||typeof b!=='object'||Array.isArray(b))return res.status(400).json({error:'The review request is incomplete.'});
  if(b.action==='submit'){
   if(typeof b.website!=='string'||b.website!==''||typeof b.comment!=='string'||b.comment.length>1600||typeof b.name!=='string'||b.name.length>80||typeof b.free!=='boolean'||!Number.isInteger(b.rating)||b.rating<1||b.rating>5||b.consent!==true)
    return res.status(400).json({error:'Choose a rating, write a short review, and confirm that it may be published.'});
   const comment=clean(b.comment),name=clean(b.name);
   if(comment.length<5||comment.length>800||name.length>40||/[\r\n\t]/.test(name))return res.status(400).json({error:'Use 5–800 characters for your review and up to 40 for your nickname.'});
   const id=randomUUID(), now=Date.now();
   const src=typeof req.headers['x-vercel-forwarded-for']==='string'?req.headers['x-vercel-forwarded-for'].trim():'';
   const ip=isIP(src)?src:'unknown';
   const network=createHmac('sha256',c.token).update('reviews/v1:'+ip).digest('hex');
   const row=JSON.stringify({id,rating:b.rating,comment,name,free:b.free,createdAt:new Date(now).toISOString()});
   const count=await redis(c,['EVAL',SUBMIT,4,PENDING,itemKey(id),NS+'rate:'+network,NS+'rate:site',id,now,row,TTL,now-TTL*1000]);
   if(Number(count)!==1)return res.status(429).json({error:'The review form has reached its submission limit. Please try again later.'});
   return res.status(201).json({received:true});
  }
  if(!['reviewQueue','publish','reject','remove'].includes(b.action))return res.status(400).json({error:'Unknown review action.'});
  if(!authorized(req,c))return res.status(401).json({error:'The moderation key is not correct.'});
  if(b.action==='reviewQueue'){
   await redis(c,['ZREMRANGEBYSCORE',PENDING,'-inf',Date.now()-TTL*1000]);
   const ids=(await redis(c,['ZREVRANGE',PENDING,0,249])||[]).filter(x=>typeof x==='string'&&ID.test(x));
   const [pending,published]=await Promise.all([
    ids.length?redis(c,['MGET',...ids.map(itemKey)]):Promise.resolve([]),
    redis(c,['EVAL',LIST_PUBLIC,2,PUBLIC_INDEX,PUBLIC,499])
   ]);
   return res.status(200).json({pending:parseRows(pending),published:parseRows(published)});
  }
  if(typeof b.id!=='string'||!ID.test(b.id))return res.status(400).json({error:'Select a review first.'});
  const result=Number(await redis(c,['EVAL',MODERATE,4,PENDING,itemKey(b.id),PUBLIC,PUBLIC_INDEX,b.action,b.id,Date.now()]));
  if(result!==1)return res.status(409).json({error:result===-1?'The published list is full.':'That review is no longer in this list.'});
  return res.status(200).json({updated:true});
 }catch{return res.status(503).json({error:unavailable})}
}
