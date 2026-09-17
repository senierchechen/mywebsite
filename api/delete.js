import { getAdminUser } from './_auth.js';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const user=await getAdminUser(req);if(!user)return res.status(401).json({error:'Требуется вход администратора.'});
  const {url}=req.body||{};if(typeof url!=='string'||!url) return res.status(400).json({error:'Недопустимый файл.'});
  try{
    const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY;
    const row=await fetch(`${base}/rest/v1/books?file_url=eq.${encodeURIComponent(url)}&select=file_path&limit=1`,{headers:{apikey:key,Authorization:req.headers.authorization}}).then(r=>r.json());
    const path=row[0]?.file_path;if(!path)return res.status(404).json({error:'Книга не найдена.'});
    const remove=await fetch(`${base}/storage/v1/object/books`,{method:'DELETE',headers:{apikey:key,Authorization:req.headers.authorization,'Content-Type':'application/json'},body:JSON.stringify({prefixes:[path]})});
    if(!remove.ok)return res.status(500).json({error:'Не удалось удалить PDF.'});
    const db=await fetch(`${base}/rest/v1/books?file_url=eq.${encodeURIComponent(url)}`,{method:'DELETE',headers:{apikey:key,Authorization:req.headers.authorization}});
    if(!db.ok)return res.status(500).json({error:'PDF удалён, но запись не удалось удалить.'});
    return res.status(200).json({ok:true});
  }catch{return res.status(500).json({error:'Не удалось удалить книгу.'});}
}
