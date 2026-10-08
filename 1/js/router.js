(function(){'use strict';
const U=window.AUXY_UTIL,UI=window.AUXY_UI;
const Router={current:'home',handlers:{},started:false};
Router.normalize=()=>{let h=location.hash||'#/home';h=h.replace(/^#\/?/,'');return h||'home'};
Router.set=route=>{const r=String(route||'home').replace(/^#\/?/,'');if(location.hash.slice(2)===r)return;location.hash='#/'+r};
Router.on=(name,fn)=>{Router.handlers[name]=fn};
Router.start=async()=>{
  const render=async()=>{
    const raw=Router.normalize(),parts=raw.split('/').filter(Boolean),name=parts[0]||'home';
    Router.current=raw;
    const fn=Router.handlers[name]||Router.handlers.home;
    try{await fn(parts.slice(1),raw)}
    catch(e){
      UI.loading(false); UI.toast(e?.message||'صفحه بارگذاری نشد','error');
      const v=document.querySelector('#view');
      if(v){
        v.innerHTML=`<section class="empty-state glass-card"><div class="empty-icon">${UI.icon('info',24)}</div><h2>بارگذاری انجام نشد</h2><p>${U.esc(e?.message||'خطای ناشناخته')}</p><button class="ios-btn primary" data-retry>${UI.icon('forward',16)}تلاش دوباره</button></section>`;
        v.querySelector('[data-retry]')?.addEventListener('click',render,{once:true});
      }
    }
  };
  if(!Router.started){window.addEventListener('hashchange',render);Router.started=true}
  await render();
};
window.AUXY_ROUTER=Router;
})();
