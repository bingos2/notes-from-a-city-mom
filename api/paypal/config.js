import {credentials,mode,errorResponse} from './_shared.js';
export default function handler(req,res){
 if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
 res.setHeader('Cache-Control','no-store');
 try { const {clientId}=credentials();return res.status(200).json({clientId,mode}); }
 catch(err){return errorResponse(res,err)}
}