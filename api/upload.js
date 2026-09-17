import { handleUpload } from '@vercel/blob/client';
import { getAdminUser } from './_auth.js';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!await getAdminUser(req))return res.status(401).json({error:'Требуется вход администратора.'});
  try{
    const body=await req.json();
    const result=await handleUpload({body,request:req,onBeforeGenerateToken:async(pathname,clientPayload)=>{
      if(!pathname.toLowerCase().endsWith('.pdf'))throw new Error('Разрешены только PDF-файлы.');
      let meta={};try{meta=JSON.parse(clientPayload||'{}')}catch{}
      const title=String(meta.title||'').trim().slice(0,180),author=String(meta.author||'').trim().slice(0,120);
      if(!title)throw new Error('Название книги обязательно.');
      return {allowedContentTypes:['application/pdf'],maximumSizeInBytes:200*1024*1024,addRandomSuffix:false,tokenPayload:JSON.stringify({title,author})};
    },onUploadCompleted:async({blob})=>{
      const response=await fetch(blob.url,{headers:{Range:'bytes=0-4'}});const bytes=new Uint8Array(await response.arrayBuffer());
      if(new TextDecoder().decode(bytes)!=='%PDF-'){const {del}=await import('@vercel/blob');await del(blob.url);throw new Error('Файл не прошёл проверку PDF.');}
    }});
    return res.status(200).json(result);
  }catch(error){return res.status(400).json({error:error instanceof Error?error.message:String(error)});}
}
