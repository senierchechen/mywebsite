import { del } from '@vercel/blob';
import { getAdminUser } from './_auth.js';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!await getAdminUser(req))return res.status(401).json({error:'Требуется вход администратора.'});
  const {url}=req.body||{};
  if(typeof url!=='string'||!url.includes('/books/'))return res.status(400).json({error:'Недопустимый файл.'});
  try{await del(url);return res.status(200).json({ok:true});}catch{return res.status(500).json({error:'Не удалось удалить книгу.'});}
}
