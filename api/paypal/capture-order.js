import {orderRequest,validateCapture,errorResponse,mode} from './_shared.js';
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 const id=String(req.body?.orderId||'');
 if(!/^[A-Z0-9]{12,24}$/.test(id))return res.status(400).json({error:'Invalid order ID'});
 if(mode==='live')return res.status(503).json({error:'Live PDF delivery is not yet enabled'});
 res.setHeader('Cache-Control','no-store');
 try{
  const data=await orderRequest('/v2/checkout/orders/'+id+'/capture','POST');
  if(!validateCapture(data))return res.status(409).json({error:'Payment has not been captured for $9.90 USD'});
  return res.status(200).json({paid:true,mode:'sandbox'});
 }catch(err){return errorResponse(res,err)}
}