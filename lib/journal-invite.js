import {createHash,timingSafeEqual} from 'node:crypto';
const CODES=Object.freeze({"fffb31a727d15e19222b3db317b32c1ff3db9cd41c81431eb724fc47092e1c21":1796396399,"35f810933149eaae011c44238b1c1e66fc0f78297c0370f3a550b4274c701a9f":1796396399,"3fce01da2805b7830bca5b54791d5b078e0b3acb87539134f18cd0c3f370dc43":1798383599,"da21ce2a4f25748dc90a4d35017674275b8bfd74d0c9037196e9f4c882b987da":1798383599,"c825c61814e742a715ebef1dba702f2f4e4f514187c2fb807444f2b0e64e4740":1798383599,"26fec988a91d23db19e364881b91d3533c4f14cf8183a753d64e1b917599d734":1798383599,"04cce1d88ecbc3e29c47b42996c5ff5b8ea4c814cbe19903c86f951e9017dd16":1798383599,"b69e185c4cabff9deabbfcd6b522ea9fed7a47bf59be1b62a724276d96a54d15":1798383599,"4ca51b5686f5847b5ece881bd36def664b0a33c926cc2312421c8bcea4bcf7dd":1798383599,"be6570f567f6fc66fa60e51f31426e9369d1b0847502cf604a5b9d768696f3e7":1798383599,"57c9d3a57e84b1f4fcfa8b0cf873f891d57eff905ee33986394bfa3f04d81d62":1798383599,"4353edb56b4f9ee628643f544e5e3697b390f1c415c7bf1511a7889fa8658e1a":1798383599,"bd183774c657f84a928f22fa4bf6e4302e0da730e43e945c6a6a721a54cb81fa":1798383599});
// Private owner test invite: store only the digest; all recruitment invites remain single-use.
const OWNER_INVITE=Object.freeze({digest:"abe2fd12cb8ee396018682b6be8aae5bfbf7d77c61cccf9fd8b3a2ce8fbe4580",expires:1803826799});
const RE=/^[a-f0-9]{64}$/;
const codePattern=/^BOOK-[A-F0-9]{32}$/;
const ORIGIN='https://www.citymomnotes.com';
const ttl=45*86400;
const hash=v=>createHash('sha256').update(v).digest('hex');
const matches=(a,b)=>typeof a==='string'&&RE.test(a)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const receiptKey=id=>'ncfm:journal:invite:v1:receipt:'+id;
const usedKey=id=>'ncfm:journal:invite:v1:used:'+id;
const redeemScript="local p=redis.call('GET',KEYS[1]); if p then if p==ARGV[1] then return 1 else return 2 end end local u=redis.call('GET',KEYS[2]); if u then return 2 end redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2]); redis.call('SET',KEYS[2],ARGV[3],'EX',ARGV[2]); return 1";
const reusableRedeemScript="local p=redis.call('GET',KEYS[1]); if p then if p==ARGV[1] then return 1 else return 2 end end redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2]); return 1";
const retry='The invite could not be checked right now. Try again in this browser.';
async function redis(cmd){
 const env=process.env,url=new URL(env.JOURNAL_REDIS_URL||env.UPSTASH_REDIS_REST_KV_REST_API_URL);
 const token=env.JOURNAL_REDIS_TOKEN||env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;
 if(url.protocol!=='https:'||url.username||url.password||!token)throw Error();
 const r=await fetch(url,{method:'POST',signal:AbortSignal.timeout(9000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(cmd)});
 const data=await r.json();if(!r.ok||data.error||!Object.hasOwn(data,'result'))throw Error();
 return data.result;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'});
 if(process.env.VERCEL_ENV!=='production'||req.headers?.origin!==ORIGIN)return res.status(403).json({error:'Open your invitation from the live City Mom editor.'});
 const body=req.body||{},action=body.action;
 const id=body.receiptId,secret=body.receiptKey;
 if(!['redeem','status'].includes(action)||typeof id!=='string'||typeof secret!=='string'||!RE.test(id)||!RE.test(secret))return res.status(400).json({error:'The invite request is incomplete.'});
 const key=receiptKey(id),proof=hash(secret);
 try{
  if(action==='status')return res.status(200).json({granted:matches(await redis(['GET',key]),proof)});
  const code=typeof body.code==='string'?body.code.trim().toUpperCase():'';
  if(!codePattern.test(code))return res.status(400).json({error:'That invite code doesn’t look right. Copy the full code and try again.'});
  const tag=hash(code),ownerInvite=matches(tag,OWNER_INVITE.digest),expires=ownerInvite?OWNER_INVITE.expires:CODES[tag];
  if(!expires||Date.now()>expires*1000)return res.status(400).json({error:'This invite code is invalid or has expired.'});
  const result=ownerInvite
   ?await redis(['EVAL',reusableRedeemScript,1,key,proof,ttl])
   :await redis(['EVAL',redeemScript,2,key,usedKey(tag),proof,ttl,id]);
  if(Number(result)!==1)return res.status(409).json({error:'This invite has already been used. To download again, open Recover order in the browser you used the first time.'});
  return res.status(200).json({granted:true});
 }catch{return res.status(503).json({error:retry})}
}
