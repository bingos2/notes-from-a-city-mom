import {orderRequest,errorResponse} from './_shared.js';
export default async function handler(req,res){
 if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
 res.setHeader('Cache-Control','no-store');
 try{
  const data=await orderRequest('/v2/checkout/orders','POST',{
   intent:'CAPTURE',purchase_units:[{reference_id:'ncfm-baby-journal',
   description:"My Baby's Little Days - digital journal",
   amount:{currency_code:'USD',value:'9.99'}}],
   application_context:{shipping_preference:'NO_SHIPPING'}
  });
  return res.status(200).json({id:data.id,mode:'sandbox'});
 }catch(err){return errorResponse(res,err)}
}