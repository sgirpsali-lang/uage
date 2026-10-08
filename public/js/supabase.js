(function(){'use strict';
  const C=window.AUXY_CONFIG;
  if(!window.supabase) throw new Error('Supabase SDK not loaded');
  const client=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_KEY,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'},
    global:{headers:{'x-auxy-client':C.VERSION}}
  });
  window.AUXY_DB=Object.freeze({client,url:C.SUPABASE_URL,key:C.SUPABASE_KEY});
})();
