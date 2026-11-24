import {orderRequest,validateCapture,errorResponse,mode} from './_shared.js';
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 res.setHeader('Cache-Control','no-store');
 const id=String(req.body?.orderId||'');
 if(!/^[A-Z0-9]{12,24}$/.test(id))return res.status(400).json({error:'Invalid order ID'});
 if(mode==='live')return res.status(503).json({error:'Live PDF delivery is not yet enabled'});
 try {
  // Read first: a previous successful capture must not be charged again.
  let data=await orderRequest('/v2/checkout/orders/'+id,'GET');
  if(data.status==='COMPLETED'){
   if(validateCapture(data))return res.status(200).json({paid:true,mode:'sandbox',alreadyCaptured:true});
   console.warn('PayPal completed order failed validation',{status:data.status,unitCount:data.purchase_units?.length,
     unitAmount:data.purchase_units?.[0]?.amount?.value,
     captureStatuses:data.purchase_units?.[0]?.payments?.captures?.map(c=>c.status),
     captureAmounts:data.purchase_units?.[0]?.payments?.captures?.map(c=>c.amount?.value)});
   return res.status(409).json({error:'PayPal reports a completed order but the payment details do not match the expected $9.90 USD. Please contact support, and do not pay again.'});
  }
  if(data.status!=='APPROVED'){
   return res.status(409).json({error:'Order is '+data.status+'; payment has not been approved for capture.'});
  }
  data=await orderRequest('/v2/checkout/orders/'+id+'/capture','POST');
  if(!validateCapture(data)){
   console.warn('PayPal capture result failed validation',{status:data.status,unitCount:data.purchase_units?.length,
     unitAmount:data.purchase_units?.[0]?.amount?.value,
     captureStatuses:data.purchase_units?.[0]?.payments?.captures?.map(c=>c.status),
     captureAmounts:data.purchase_units?.[0]?.payments?.captures?.map(c=>c.amount?.value)});
   return res.status(409).json({error:'Payment is not yet verified as a completed $9.90 USD capture. Please do not retry payment until the order is checked.'});
  }
  return res.status(200).json({paid:true,mode:'sandbox'});
 }catch(err){return errorResponse(res,err)}
}