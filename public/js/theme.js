(function(){'use strict';
const KEY='auxy-theme',VALID=new Set(['black','graphite','silver','white','obsidian','ice','midnight','mono','ocean','forest','sunset','crimson','gold','carbon']);
const norm=t=>VALID.has(t)?t:'black';
function get(){try{return norm(localStorage.getItem(KEY)||'black')}catch{return'black'}}
function apply(theme,save=true){const t=norm(theme);document.documentElement.dataset.auxyTheme=t;if(save)try{localStorage.setItem(KEY,t)}catch{};return t}
function init(){apply(get(),false)}
window.AUXY_THEME={KEY,VALID:[...VALID],get,apply,init};init();
})();
