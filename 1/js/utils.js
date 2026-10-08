(function(){'use strict';
  const C=window.AUXY_CONFIG;
  const U={
    esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))},
    username(v){return String(v??'').trim().replace(/^@+/,'').toLowerCase()},
    validUsername(v){v=U.username(v);return C.USERNAME_RE.test(v)&&!/^_|_$|__/.test(v)&&/[a-z]/.test(v)},
    formatCount(n){return Number(n||0).toLocaleString('fa-IR')},
    time(v){try{return new Date(v).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'})}catch{return ''}},
    ago(v){const s=(Date.now()-new Date(v).getTime())/1000;if(!Number.isFinite(s))return '';if(s<60)return 'همین الان';if(s<3600)return `${Math.round(s/60)} دقیقه پیش`;if(s<86400)return `${Math.round(s/3600)} ساعت پیش`;return `${Math.round(s/86400)} روز پیش`},
    slug(v){return U.username(v)},
    debounce(fn,wait=250){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),wait)}},
    escapeUrl(v){try{return encodeURI(String(v||''))}catch{return ''}},
    initials(p){return String(p?.display_name||p?.username||'A').trim().slice(0,2).toUpperCase()},
    sleep(ms){return new Promise(r=>setTimeout(r,ms))}
  };
  U.emojiText=function(v){try{if(window.AUXY_EMOJI&&typeof window.AUXY_EMOJI.renderText==='function')return window.AUXY_EMOJI.renderText(v); }catch{} return U.esc(v)};
  U.emojitext=U.emojiText;
  window.AUXY_UTIL=U;
})();
