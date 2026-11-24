/** PayPal sandbox Orders v2 - server only. Live checkout must stay disabled until server-controlled PDF delivery exists. */
const LIVE = process.env.PAYPAL_MODE === 'live';
export const mode = LIVE ? 'live' : 'sandbox';
export const base = LIVE ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
export function credentials(){
 const clientId=process.env.PAYPAL_SANDBOX_CLIENT_ID || process.env.PAYPAL_CLIENT_ID;
 const secret=process.env.PAYPAL_SANDBOX_CLIENT_SECRET_KEY || process.env.PAYPAL_CLIENT_SECRET_KEY || process.env.PAYPAL_CLIENT_SECRET;
 if(!clientId || !secret) throw new Error('PayPal credentials unavailable in this environment');
 if(LIVE) throw new Error('Live checkout disabled until paid PDF delivery is protected');
 return {clientId,secret};
}
export async function token(){
 const {clientId,secret}=credentials();
 const r=await fetch(base+'/v1/oauth2/token',{method:'POST',
 headers:{Authorization:'Basic '+Buffer.from(clientId+':'+secret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},
 body:'grant_type=client_credentials'});
 if(!r.ok) throw new Error('PayPal authentication failed ('+r.status+')');
 return (await r.json()).access_token;
}
export async function orderRequest(path,method='GET',body){
 const bearer=await token();
 const r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json','PayPal-Request-Id':(method==='POST'&&path.endsWith('/capture')?'ncfm-capture-'+path.split('/')[4]:crypto.randomUUID())},body:body?JSON.stringify(body):undefined});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error('PayPal request failed ('+r.status+')');
 return data;
}
export function validateCapture(data){
 const units=Array.isArray(data.purchase_units)?data.purchase_units:[];
 if(data.status!=='COMPLETED'||units.length!==1)return false;
 const unit=units[0];
 const captures=unit.payments?.captures||[];
 if(!Array.isArray(captures)||captures.length!==1)return false;
 const capture=captures[0];
 // purchase_units[].amount is optional in PayPal's capture response.
 // The completed capture itself MUST show the exact paid amount.
 const match=amount=>amount?.currency_code==='USD'&&amount?.value==='9.90';
 return capture.status==='COMPLETED'&&match(capture.amount)&&
   (!unit.amount || match(unit.amount));
}
export function errorResponse(res,err){
 console.error('PayPal checkout',{name:err.name,message:err.message});
 return res.status(502).json({error:err.message||'Checkout temporarily unavailable'});
}