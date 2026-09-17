let supabase;
const auth=document.querySelector('#auth'),dashboard=document.querySelector('#dashboard'),message=document.querySelector('#message');
const loginForm=document.querySelector('#loginForm'),registerForm=document.querySelector('#registerForm'),resetForm=document.querySelector('#resetForm');
const books=document.querySelector('#books');
const msg=t=>message.textContent=t||'';

(async()=>{
  try{
    const cfg=await fetch('/api/config').then(r=>r.json());
    if(!cfg.url||!cfg.anonKey)throw new Error('Сначала подключите Supabase в Vercel Environment Variables.');
    supabase=window.supabase.createClient(cfg.url,cfg.anonKey);
    document.querySelectorAll('[data-eye]').forEach(b=>b.onclick=()=>{const i=document.getElementById(b.dataset.eye);i.type=i.type==='password'?'text':'password';b.textContent=i.type==='password'?'◉':'◎';});
    document.querySelector('#loginTab').onclick=()=>switchForm('login');
    document.querySelector('#registerTab').onclick=()=>switchForm('register');
    document.querySelector('#forgot').onclick=()=>switchForm('reset');
    document.querySelector('#backLogin').onclick=()=>switchForm('login');
    loginForm.onsubmit=login;registerForm.onsubmit=register;resetForm.onsubmit=resetPassword;
    document.querySelector('#logout').onclick=()=>supabase.auth.signOut();
    supabase.auth.onAuthStateChange((_e,session)=>session?checkAdmin(session):showAuth());
    const {data:{session}}=await supabase.auth.getSession(); if(session)checkAdmin(session);
  }catch(e){msg(e.message);}
})();

function switchForm(which){loginForm.hidden=which!=='login';registerForm.hidden=which!=='register';resetForm.hidden=which!=='reset';document.querySelector('#loginTab').classList.toggle('active',which==='login');document.querySelector('#registerTab').classList.toggle('active',which==='register');msg('');}
function showAuth(){auth.hidden=false;dashboard.hidden=true;}
async function checkAdmin(session){const {data,error}=await supabase.from('admin_profiles').select('role').eq('id',session.user.id).maybeSingle();if(error||data?.role!=='admin'){await supabase.auth.signOut();showAuth();msg('Этот аккаунт не является администратором.');return;}auth.hidden=true;dashboard.hidden=false;loadBooks();}
async function login(e){e.preventDefault();msg('');const email=loginEmail.value.trim(),password=loginPassword.value;const {error}=await supabase.auth.signInWithPassword({email,password});if(error)msg(error.message);}
async function register(e){e.preventDefault();msg('');if(registerPassword.value!==registerPassword2.value)return msg('Пароли не совпадают.');const {error}=await supabase.auth.signUp({email:registerEmail.value.trim(),password:registerPassword.value,options:{emailRedirectTo:`${location.origin}${location.pathname}`}});if(error)return msg(error.message);registerForm.reset();msg('Письмо для подтверждения отправлено на вашу почту. После подтверждения вернитесь сюда и войдите.');}
async function resetPassword(e){e.preventDefault();msg('');const {error}=await supabase.auth.resetPasswordForEmail(resetEmail.value.trim(),{redirectTo:`${location.origin}${location.pathname}`});if(error)msg(error.message);else{resetForm.reset();msg('Письмо для сброса пароля отправлено.');}}

async function loadBooks(){books.innerHTML='<div class="muted">Загрузка…</div>';const r=await fetch('/api/books');const data=await r.json();if(!data.books?.length){books.innerHTML='<div class="muted">Книг пока нет.</div>';return;}books.innerHTML=data.books.map(b=>`<article class="book"><div><strong>${esc(b.title)}</strong><small>${esc(b.author||'Автор не указан')} · ${size(b.size)}</small></div><div class="actions"><a href="${esc(b.url)}" target="_blank" rel="noopener">Открыть</a> <button class="danger" data-url="${encodeURIComponent(b.url)}">Удалить</button></div></article>`).join('');books.querySelectorAll('.danger').forEach(b=>b.onclick=()=>removeBook(decodeURIComponent(b.dataset.url)));}
async function removeBook(url){if(!confirm('Удалить эту книгу?'))return;const {data:{session}}=await supabase.auth.getSession();const r=await fetch('/api/delete',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({url})});if(!r.ok)alert((await r.json()).error||'Ошибка удаления');else loadBooks();}

document.querySelector('#bookForm').onsubmit=async e=>{e.preventDefault();const out=document.querySelector('#uploadMessage'),file=document.querySelector('#pdf').files[0];out.textContent='';if(!file)return out.textContent='Выберите PDF.';if(file.size>200*1024*1024)return out.textContent='Файл больше 200 МБ.';if(!file.name.toLowerCase().endsWith('.pdf')||file.type!=='application/pdf')return out.textContent='Разрешены только PDF-файлы.';const head=new Uint8Array(await file.slice(0,5).arrayBuffer());if(new TextDecoder().decode(head)!=='%PDF-')return out.textContent='Файл не является настоящим PDF.';const {data:{session}}=await supabase.auth.getSession();if(!session)return out.textContent='Сессия истекла.';out.textContent='Загрузка…';try{const path=`books/${Date.now()}__${encodeURIComponent(document.querySelector('#title').value.trim())}__${encodeURIComponent(document.querySelector('#author').value.trim())}.pdf`;const {data,error}=await supabase.storage.from('books').upload(path,file,{contentType:'application/pdf',upsert:false});if(error)throw error;const {data:pub}=supabase.storage.from('books').getPublicUrl(data.path);const {error:dbError}=await supabase.from('books').insert({title:document.querySelector('#title').value.trim(),author:document.querySelector('#author').value.trim(),file_path:data.path,file_url:pub.publicUrl,file_size:file.size,created_by:session.user.id});if(dbError){await supabase.storage.from('books').remove([data.path]);throw dbError;}e.target.reset();out.textContent='Книга опубликована.';loadBooks();}catch(err){out.textContent=err.message||'Ошибка загрузки.';}};
function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}function size(n){if(!n)return '';let i=0,x=n,u=['Б','КБ','МБ','ГБ'];while(x>=1024&&i<3){x/=1024;i++;}return `${x.toFixed(i?1:0)} ${u[i]}`;}
