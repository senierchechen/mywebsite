export const COOKIE='supabase_access_token';

export async function getAdminUser(req){
  const auth=String(req.headers.authorization||'');
  if(!auth.startsWith('Bearer ')) return null;
  const token=auth.slice(7);
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY;
  if(!url||!key||!token)return null;
  try{
    const r=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${token}`} });
    if(!r.ok)return null;
    const user=await r.json();
    const p=await fetch(`${url}/rest/v1/admin_profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role&limit=1`,{headers:{apikey:key,Authorization:`Bearer ${token}`} });
    if(!p.ok)return null;
    const rows=await p.json();
    return rows[0]?.role==='admin'?user:null;
  }catch{return null;}
}

export async function requireAdmin(req,res){const user=await getAdminUser(req);if(!user){res.status(401).json({error:'Требуется вход администратора.'});return null;}return user;}
