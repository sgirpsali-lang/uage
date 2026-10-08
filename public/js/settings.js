(function(){'use strict';
const A=window.AUXY_AUTH,db=window.AUXY_DB.client,U=window.AUXY_UTIL,UI=window.AUXY_UI,C=window.AUXY_COMPONENTS,T=window.AUXY_THEME;
const opts=[['black','مشکی'],['graphite','گرافیتی'],['silver','نقره‌ای'],['white','سفید'],['obsidian','Obsidian'],['ice','Ice'],['midnight','Midnight'],['mono','Mono'],['ocean','Ocean'],['forest','Forest'],['sunset','Sunset'],['crimson','Crimson'],['gold','Gold'],['carbon','Carbon']];
function renderTheme(){return `<div class="theme-swatches">${opts.map(([id,label])=>`<button type="button" class="theme-swatch ${id}" data-theme="${id}" aria-label="${label}" title="${label}"></button>`).join('')}</div>`}
async function readSettings(me){try{const r=await db.rpc('get_my_settings');if(!r.error&&r.data)return(Array.isArray(r.data)?r.data[0]:r.data)||{}}catch{}try{const r=await db.from('user_private').select('settings').eq('user_id',me.id).maybeSingle();return r.data?.settings||{}}catch{return{}}}
async function saveSetting(key,value){try{const r=await db.rpc('set_my_setting',{p_key:key,p_value:value});if(r.error)throw r.error;return true}catch(e){console.warn('[AUXY_SETTINGS]',e);UI.toast('تنظیمات روی همین دستگاه ذخیره شد.','');return false}}
async function render(view,{me}){UI.loading(true,'در حال آماده‌سازی تنظیمات…');try{
const [priv,sess,settings]=await Promise.all([db.from('user_private').select('recovery_email,settings').eq('user_id',me.id).maybeSingle(),A.session(),readSettings(me)]);
const rec=priv.data?.recovery_email||'';const savedTheme=settings?.theme||T.get();T.apply(savedTheme,false);
view.innerHTML=`<div class="settings-page"><div class="page-head"><div><div class="eyebrow">SETTINGS</div><h1>تنظیمات</h1><p>حساب، امنیت، ظاهر و حریم خصوصی.</p></div></div>
<section class="settings-profile glass-card">${UI.avatar(me,76)}<div class="grow">${C.identity(me)}<small class="settings-role">${U.esc(me.role||'user')}</small></div>${UI.button('ویرایش پروفایل','edit-profile','primary','settings')}</section>
<div class="settings-grid">
<section class="settings-section glass-card"><h3>حساب</h3><div class="setting-action">${UI.button('تعویض حساب','switch-account','','users')}${UI.button('حذف حساب','delete-account','danger','close')}</div><p class="muted">جلسهٔ فعلی بسته می‌شود.</p></section>
<section class="settings-section glass-card"><h3>امنیت</h3><div class="device-row"><span class="online-dot"></span><div><b>این دستگاه</b><small>جلسه فعال · ${sess?.user?.id?'فعال':'نامشخص'}</small></div></div>${UI.button('خروج از این دستگاه','signout-local','','close')}${UI.button('خروج از همه دستگاه‌ها','signout-all','danger','close')}</section>
<section class="settings-section glass-card"><h3>ایمیل بازیابی</h3><p class="muted">برای بازیابی حساب استفاده می‌شود.</p><div class="field"><label>ایمیل بازیابی</label><input id="recovery-email" class="input" type="email" dir="ltr" value="${U.esc(rec)}" placeholder="example@email.com"></div>${UI.button(rec?'ذخیره تغییرات':'اتصال ایمیل','save-recovery','primary','check')}</section>
<section class="settings-section glass-card coming-soon-card"><h3>خدمات آینده</h3><p class="muted">این بخش‌ها فعلاً فعال نیستند.</p><div class="hero-actions"><button type="button" class="ios-btn" data-action="coming-soon">به‌زودی</button><button type="button" class="ios-btn" data-action="coming-soon">به‌زودی</button></div></section>
<section class="settings-section glass-card"><h3>ظاهر</h3><p class="muted">تم برنامه فوراً تغییر می‌کند.</p>${renderTheme()}<div class="option-row"><span>کاهش حرکت</span><input id="reduce-motion" type="checkbox" ${settings?.reduce_motion?'checked':''}></div></section>
<section class="settings-section glass-card"><h3>حریم خصوصی</h3><div class="option-row"><span>نمایش وضعیت آنلاین</span><input id="online-status" type="checkbox" ${settings?.online_status!==false?'checked':''}></div><div class="option-row"><span>اجازهٔ پیام از کاربران</span><input id="dm-allow" type="checkbox" ${settings?.dm_allow!==false?'checked':''}></div><div class="option-row"><span>پخش خودکار ویدیوها</span><input id="autoplay" type="checkbox" ${settings?.autoplay!==false?'checked':''}></div></section>
<section class="settings-section glass-card"><h3>اعلان‌ها</h3><div class="option-row"><span>لایک و نظر</span><input id="notif-likes" type="checkbox" ${settings?.notif_likes!==false?'checked':''}></div><div class="option-row"><span>پیام جدید</span><input id="notif-messages" type="checkbox" ${settings?.notif_messages!==false?'checked':''}></div><div class="option-row"><span>امنیت حساب</span><input id="notif-security" type="checkbox" ${settings?.notif_security!==false?'checked':''}></div></section>
</div></div>`;
view.querySelectorAll('[data-theme]').forEach(b=>b.onclick=async()=>{const t=T.apply(b.dataset.theme,true);await saveSetting('theme',t);document.documentElement.dataset.auxyTheme=t;UI.toast('تم ذخیره شد','success')});
view.querySelectorAll('.option-row input').forEach(inp=>inp.addEventListener('change',()=>saveSetting(inp.id.replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),inp.checked)));
view.onclick=async e=>{const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
if(a==='coming-soon')return UI.toast('به‌زودی فعال می‌شود.','info');
if(a==='edit-profile')return window.AUXY_SOCIAL.editProfile();
if(a==='switch-account'||a==='signout-local')return A.signOut(false);
if(a==='signout-all')return A.signOut(true);
if(a==='save-recovery'){const email=view.querySelector('#recovery-email').value.trim();if(email&&!/^\S+@\S+\.\S+$/.test(email))return UI.toast('ایمیل معتبر نیست.','error');try{await A.linkRecoveryEmail(email);UI.toast(email?'ایمیل بازیابی ذخیره شد.':'ایمیل بازیابی حذف شد.','success')}catch(x){UI.toast(x.message||'ذخیره ایمیل انجام نشد.','error')}return}
if(a==='delete-account'){await UI.modal({title:'حذف حساب',content:'<p class="muted">این عملیات قابل بازگشت نیست.</p>',actions:[{label:'انصراف'},{label:'حذف حساب',kind:'danger',run:async()=>{const r=await db.rpc('delete_my_account',{});if(r.error)throw r.error;await A.signOut(false);location.replace('/login/');return true}}]})}
};
}finally{UI.loading(false)}}
window.AUXY_SETTINGS={render};
})();
