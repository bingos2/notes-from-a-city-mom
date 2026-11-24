import {credentials,mode,token,errorResponse} from './_shared.js';
export default async function handler(req,res){
 if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
 res.setHeader('Cache-Control','no-store');
 try {
   const {clientId}=credentials();
   await token(); // Verifies the configured ID/secret against the sandbox API.
   return res.status(200).json({clientId,mode});
 } catch(err){
   console.error('PayPal sandbox configuration failed:',err.message);
   return res.status(503).json({error:'PayPal Sandbox credentials could not be verified. Please set a matching Sandbox Client ID and Secret in Vercel (not Live credentials).'});
 }
}