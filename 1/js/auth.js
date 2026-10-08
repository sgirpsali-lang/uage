(function(){'use strict';
  const {client}=window.AUXY_DB,C=window.AUXY_CONFIG,U=window.AUXY_UTIL;
  const A={};
  async function session(){const r=await client.auth.getSession();return r?.data?.session||null}
  async function profile(){const s=await session();if(!s)return null;let r=await client.from('profiles').select('*').eq('id',s.user.id).maybeSingle();if(r.error)throw r.error;if(!r.data){const e=await client.rpc('ensure_profile');if(e.error)throw e.error;r=await client.from('profiles').select('*').eq('id',s.user.id).maybeSingle()}return r.data}
  async function resolveUsername(username){
    const u=U.username(username);let r=await client.rpc('resolve_username_login',{p_username:u});
    if(!r.error&&r.data){const row=Array.isArray(r.data)?r.data[0]:r.data;if(row?.email)return row}
    const p=await client.from('profiles').select('id,username,is_banned').eq('username',u).maybeSingle();if(p.error)throw p.error;if(!p.data)throw new Error('این نام کاربری وجود ندارد.');if(p.data.is_banned)throw new Error('این حساب مسدود شده است.');
    const priv=await client.from('user_private').select('email').eq('user_id',p.data.id).maybeSingle();if(priv.error)throw priv.error;if(priv.data?.email)return{email:priv.data.email,user_id:p.data.id,has_password:true};
    return{email:`${u}@accounts.auxy.ir`,user_id:p.data.id,has_password:true};
  }
  async function login(username,password){
    if(!U.validUsername(username))throw new Error('نام کاربری معتبر نیست.');if(String(password||'').length<1)throw new Error('رمز عبور را وارد کنید.');
    const info=await resolveUsername(username);const r=await client.auth.signInWithPassword({email:info.email,password});if(r.error)throw new Error(/invalid login|invalid credentials/i.test(r.error.message||'')?'نام کاربری یا رمز عبور اشتباه است.':r.error.message||'ورود انجام نشد.');return r.data.session;
  }
  async function signup(username,recoveryEmail,password){
    const u=U.username(username),rec=String(recoveryEmail||'').trim().toLowerCase();
    if(!U.validUsername(u))throw new Error('نام کاربری باید ۳ تا ۲۴ نویسه باشد و فقط شامل حروف انگلیسی، عدد و _ باشد.');
    if(String(password||'').length<8)throw new Error('رمز عبور باید حداقل ۸ نویسه باشد.');
    if(rec&&!/^\S+@\S+\.\S+$/.test(rec))throw new Error('ایمیل ثبت‌شده معتبر نیست.');
    const exists=await client.from('profiles').select('id').eq('username',u).maybeSingle();if(exists.error)throw exists.error;if(exists.data)throw new Error('این نام کاربری قبلاً ثبت شده است.');
    const email=`${u}@accounts.auxy.ir`;
    const r=await client.auth.signUp({email,password,options:{data:{username:u,recovery_email:rec||null,display_name:u}}});if(r.error)throw new Error(/already|registered|duplicate/i.test(r.error.message||'')?'این نام کاربری قبلاً ثبت شده است.':r.error.message||'ثبت‌نام انجام نشد.');
    if(!r.data?.user)throw new Error('ساخت حساب انجام نشد.');
    let active=r.data.session||null;
    if(!active){
      const retry=await client.auth.signInWithPassword({email,password});
      if(!retry.error)active=retry.data.session;
      else throw new Error(/confirm|email/i.test(retry.error.message||'')?'حساب ساخته شد ولی ورود خودکار فعال نشد. SQL نسخه A4 را اجرا و دوباره امتحان کنید.':retry.error.message||'ورود پس از ثبت‌نام انجام نشد.');
    }
    const setup=await client.rpc('auxy_complete_username_signup',{p_username:u,p_recovery_email:rec||null});
    if(setup.error)throw new Error(setup.error.message||'تکمیل حساب انجام نشد.');
    return active;
  }
  function recoveryError(code){const m={username_not_found:'این نام کاربری وجود ندارد.',email_mismatch:'این ایمیل با ایمیل بازیابی حساب مطابقت ندارد.',no_recovery_email:'برای این حساب ایمیل بازیابی ثبت نشده است.',rate_limited:'کمی صبر کنید و دوباره درخواست بدهید.',too_many_attempts:'تعداد تلاش‌های ناموفق زیاد است؛ یک کد جدید درخواست کنید.',invalid_request:'نام کاربری و ایمیل را کامل وارد کنید.',delivery_not_configured:'ارسال ایمیل بازیابی هنوز در Supabase تنظیم نشده است. Secretهای ایمیل نسخه A4 را ثبت کنید.',invalid_code:'کد بازیابی صحیح نیست یا منقضی شده است.',weak_password:'رمز جدید باید حداقل ۸ نویسه باشد.',delivery_failed:'ارسال ایمیل بازیابی ناموفق بود؛ تنظیمات ایمیل Supabase را بررسی کنید.'};return m[code]||'عملیات بازیابی انجام نشد.'}
  async function sendRecovery(username,email){
    const u=U.username(username),e=String(email||'').trim().toLowerCase();if(!U.validUsername(u))throw new Error('نام کاربری معتبر نیست.');if(!/^\S+@\S+\.\S+$/.test(e))throw new Error('ایمیل ثبت‌شده را وارد کنید.');
    const r=await client.rpc('auxy_request_password_recovery',{p_username:u,p_email:e});if(r.error)throw r.error;const d=Array.isArray(r.data)?r.data[0]:r.data;if(d?.ok===false)throw new Error(recoveryError(d.code));return d;
  }
  async function verifyRecovery(email,code,newPassword){
    if(String(newPassword||'').length<8)throw new Error('رمز جدید باید حداقل ۸ نویسه باشد.');if(!/^\d{6}$/.test(String(code||'').trim()))throw new Error('کد بازیابی باید ۶ رقمی باشد.');
    const r=await client.rpc('auxy_verify_password_recovery',{p_email:String(email||'').trim().toLowerCase(),p_code:String(code||'').trim(),p_new_password:String(newPassword)});if(r.error)throw r.error;const d=Array.isArray(r.data)?r.data[0]:r.data;if(d?.ok===false)throw new Error(recoveryError(d.code));return d;
  }
  async function linkRecoveryEmail(email){const r=await client.rpc('auxy_link_recovery_email',{p_email:email||null});if(r.error)throw r.error;return r.data}
  async function signOut(global=false){await client.auth.signOut(global?{scope:'global'}:undefined);location.replace(C.LOGIN_PATH)}
  A.session=session;A.profile=profile;A.login=login;A.signup=signup;A.sendRecovery=sendRecovery;A.verifyRecovery=verifyRecovery;A.linkRecoveryEmail=linkRecoveryEmail;A.signOut=signOut;window.AUXY_AUTH=A;
})();
