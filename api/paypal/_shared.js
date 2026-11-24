/** PayPal Orders v2. Credentials must only be read on the server. */
const LIVE = process.env.PAYPAL_MODE === 'live';
export const mode = LIVE ? 'live' : 'sandbox';
export const base = LIVE ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
export function credentials() {
 const clientId = process.env.PAYPAL_CLIENT_ID;
 const secret = process.env.PAYPAL_CLIENT_SECRET_KEY || process.env.PAYPAL_CLIENT_SECRET;
 if (!clientId || !secret) throw new Error('PayPal credentials are missing in this deployment environment');
 if (LIVE) throw new Error('Live PayPal is disabled until server-protected PDF delivery is ready');
 return {clientId,secret};
}
export async function token() {
 const {clientId,secret}=credentials();
 const response=await fetch(base+'/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(clientId+':'+secret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
 if (!response.ok) throw new Error('PayPal authentication failed ('+response.status+')');
 const data=await response.json();return data.access_token;
}
export async function orderRequest(path,method='GET',body) {
 const bearer=await token();
 const headers={Authorization:'Bearer '+bearer,'Content-Type':'application/json','PayPal-Request-Id':crypto.randomUUID()};
 const response=await fetch(base+path,{method,headers,body:body?JSON.stringify(body):undefined});
 const data=await response.json().catch(()=>({}));
 if (!response.ok) throw new Error('PayPal request failed ('+response.status+')');
 return data;
}
export function validateCapture(data) {
 const units=Array.isArray(data.purchase_units)?data.purchase_units:[];
 const captures=units.flatMap(u=>u.payments?.captures||[]);
 return data.status==='COMPLETED' && units.length===1 &&
   captures.some(c=>c.status==='COMPLETED'&&c.amount?.currency_code==='USD'&&c.amount?.value==='9.99');
}
export function errorResponse(res,err){console.error('PayPal integration',{name:err.name,message:err.message});return res.status(502).json({error:err.message||'Checkout is temporarily unavailable'})}
