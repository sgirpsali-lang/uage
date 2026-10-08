(function(){'use strict';
  const listeners=new Set();
  const S={session:null,user:null,profile:null,route:'home',busy:false};
  window.AUXY_STATE=Object.freeze({
    get:()=>S,
    patch(next){Object.assign(S,next);listeners.forEach(fn=>fn(S));},
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)}
  });
})();
