(function(){'use strict';
const U=window.AUXY_UTIL,UI=window.AUXY_UI;
function readImage(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('خواندن تصویر انجام نشد.'));im.src=r.result};r.onerror=()=>reject(new Error('خواندن فایل انجام نشد.'));r.readAsDataURL(file)})}
async function cropImage(file){
  if(!file||!String(file.type||'').startsWith('image/'))throw new Error('فایل تصویر معتبر نیست.');
  const img=await readImage(file);let zoom=1,rot=0,ox=0,oy=0,drag=false,lastX=0,lastY=0,result=null;
  const out=await UI.modal({title:'ویرایش عکس پروفایل',content:`<div class="crop-editor"><div class="crop-stage"><canvas id="crop-canvas" width="340" height="340"></canvas><div class="crop-guide"></div></div><div class="crop-tools"><label class="crop-range"><span>بزرگنمایی</span><input id="crop-zoom" type="range" min="1" max="3.2" step="0.01" value="1"></label><div class="crop-tool-row"><button type="button" class="icon-button" id="crop-rot-left" aria-label="چرخش چپ">${UI.icon('back',18)}</button><button type="button" class="icon-button" id="crop-reset" aria-label="بازنشانی">${UI.icon('maximize',18)}</button><button type="button" class="icon-button" id="crop-rot-right" aria-label="چرخش راست">${UI.icon('forward',18)}</button></div><small class="muted">عکس را با انگشت یا ماوس جابه‌جا کن و قاب را روی بخش موردنظر قرار بده.</small></div></div>`,actions:[{label:'لغو'},{label:'استفاده از عکس',kind:'primary',run:async root=>{const c=root.querySelector('#crop-canvas');result=await new Promise((resolve,reject)=>c.toBlob(resolve,'image/webp',.92));if(!result)throw new Error('ساخت تصویر برش‌خورده انجام نشد.');return true}}],onOpen:root=>{
    const c=root.querySelector('#crop-canvas'),ctx=c.getContext('2d'),z=root.querySelector('#crop-zoom');
    const draw=()=>{const S=c.width,base=Math.max(S/img.width,S/img.height),scale=base*zoom,w=img.width*scale,h=img.height*scale;ctx.clearRect(0,0,S,S);ctx.save();ctx.translate(S/2+ox,S/2+oy);ctx.rotate(rot*Math.PI/180);ctx.drawImage(img,-w/2,-h/2,w,h);ctx.restore()};
    const point=e=>{const p=e.touches?.[0]||e;return{x:p.clientX,y:p.clientY}};
    const start=e=>{e.preventDefault();drag=true;const p=point(e);lastX=p.x;lastY=p.y};
    const move=e=>{if(!drag)return;e.preventDefault();const p=point(e);ox+=p.x-lastX;oy+=p.y-lastY;lastX=p.x;lastY=p.y;draw()};
    const end=()=>drag=false;
    c.addEventListener('mousedown',start);window.addEventListener('mousemove',move);window.addEventListener('mouseup',end);c.addEventListener('touchstart',start,{passive:false});window.addEventListener('touchmove',move,{passive:false});window.addEventListener('touchend',end);
    z.oninput=()=>{zoom=Number(z.value);draw()};root.querySelector('#crop-rot-left').onclick=()=>{rot=(rot+270)%360;draw()};root.querySelector('#crop-rot-right').onclick=()=>{rot=(rot+90)%360;draw()};root.querySelector('#crop-reset').onclick=()=>{zoom=1;rot=0;ox=0;oy=0;z.value='1';draw()};draw();
  }});
  return result?new File([result],`auxy-profile-${Date.now()}.webp`,{type:'image/webp'}):null;
}
UI.cropImage=cropImage;
})();
