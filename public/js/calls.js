(function(){'use strict';
  const DB=()=>window.AUXY_DB?.client, UI=()=>window.AUXY_UI, U=()=>window.AUXY_UTIL;
  const STUN=[
    {urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']},
    {urls:'stun:stun.cloudflare.com:3478'}
  ];
  const cfg=()=>window.AUXY_CONFIG||{};
  const ICE=()=>Array.isArray(cfg().TURN_SERVERS)&&cfg().TURN_SERVERS.length?[...STUN,...cfg().TURN_SERVERS]:STUN;
  const state={me:null,rooms:new Map(),watching:new Set(),pc:null,stream:null,remoteStream:null,conversationId:null,peerId:null,callId:null,type:null,role:null,pendingOffer:null,queuedIce:[],overlay:null,closed:false};
  function me(){return state.me}
  function signalEnvelope(kind,data={}){return {kind,...data,from:state.me?.id,to:data.to||null,callId:state.callId,at:Date.now()}}
  async function room(id){
    if(state.rooms.has(id))return state.rooms.get(id).promise;
    const db=DB(); if(!db)throw new Error('اتصال دیتابیس آماده نیست.');
    let resolveSub,rejectSub; const promise=new Promise((res,rej)=>{resolveSub=res;rejectSub=rej});
    const ch=db.channel('auxy-call-'+id);
    const item={ch,promise,subscribed:false}; state.rooms.set(id,item);
    ch.on('broadcast',{event:'signal'},payload=>{try{handleSignal(payload?.payload||payload?.data||payload)}catch(e){console.error('[AUXY_CALL]',e)}});
    ch.subscribe(status=>{if(status==='SUBSCRIBED'){item.subscribed=true;resolveSub(ch)}else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){rejectSub(new Error('کانال تماس به Realtime وصل نشد.'))}});
    return promise;
  }
  async function watch(ids=[]){
    const list=[...new Set((ids||[]).filter(Boolean))];
    for(const id of list){if(state.watching.has(id))continue;state.watching.add(id);try{await room(id)}catch(e){console.warn('[AUXY_CALL] watch',e)}}
  }
  function stopRoom(id){const item=state.rooms.get(id);if(item)DB()?.removeChannel(item.ch);state.rooms.delete(id);state.watching.delete(id)}
  function clearOverlay(){if(state.overlay){state.overlay.remove();state.overlay=null}}
  function showOverlay(mode){
    clearOverlay(); const root=document.querySelector('#modal-root'); if(!root)return;
    const incoming=mode==='incoming',video=state.type==='video';
    const layer=document.createElement('div');layer.className='modal-layer call-layer';
    layer.innerHTML=`<section class="call-window glass-card"><div class="call-top"><div><b>${incoming?'تماس ورودی':video?'تماس تصویری':'تماس صوتی'}</b><small>${incoming?'یک تماس از حساب مقابل دریافت شد.':state.role==='caller'?'در حال برقراری تماس…':'تماس متصل است.'}</small></div><button id="call-close" class="icon-button" aria-label="بستن">${UI().icon('phoneDown',19)}</button></div><div class="call-stage ${video?'video':'audio'}">${video?'<video id="call-remote" autoplay playsinline></video><video id="call-local" autoplay muted playsinline></video>':'<div class="call-avatar">'+UI().icon('phone',34)+'</div>'}</div><div class="call-actions">${incoming?'<button class="ios-btn primary" id="call-accept">پاسخ</button><button class="ios-btn danger" id="call-reject">رد تماس</button>':`<button class="ios-btn" id="call-mute">${UI().icon('mic',17)} میکروفون</button>${video?'<button class="ios-btn" id="call-camera">'+UI().icon('video',17)+' دوربین</button>':''}<button class="ios-btn danger" id="call-end">پایان تماس</button>`}</div></section>`;
    root.appendChild(layer); state.overlay=layer;
    layer.querySelector('#call-close')?.addEventListener('click',()=>endCall(false));
    layer.querySelector('#call-end')?.addEventListener('click',()=>endCall(true));
    layer.querySelector('#call-reject')?.addEventListener('click',()=>rejectIncoming());
    layer.querySelector('#call-accept')?.addEventListener('click',()=>acceptIncoming().catch(e=>{UI().toast(e.message,'error');endCall(false)}));
    layer.querySelector('#call-mute')?.addEventListener('click',()=>toggleMute(layer));
    layer.querySelector('#call-camera')?.addEventListener('click',()=>toggleCamera(layer));
    if(video&&state.stream){const local=layer.querySelector('#call-local');if(local){local.srcObject=state.stream;local.play().catch(()=>{})}}
    if(video&&state.remoteStream){const remote=layer.querySelector('#call-remote');if(remote){remote.srcObject=state.remoteStream;remote.play().catch(()=>{})}}
  }
  function toggleMute(layer){const t=state.stream?.getAudioTracks?.()[0];if(!t)return;t.enabled=!t.enabled;const b=layer.querySelector('#call-mute');if(b)b.innerHTML=(t.enabled?UI().icon('mic',17):UI().icon('micOff',17))+' '+(t.enabled?'میکروفون':'میکروفون خاموش')}
  function toggleCamera(layer){const t=state.stream?.getVideoTracks?.()[0];if(!t)return;t.enabled=!t.enabled;const b=layer.querySelector('#call-camera');if(b)b.innerHTML=(t.enabled?UI().icon('video',17):UI().icon('videoOff',17))+' '+(t.enabled?'دوربین':'دوربین خاموش')}
  function resetMedia(){try{state.stream?.getTracks?.().forEach(t=>t.stop())}catch{};state.stream=null;state.remoteStream=null;state.queuedIce=[]}
  async function send(sig){const ch=await room(state.conversationId);await ch.send({type:'broadcast',event:'signal',payload:signalEnvelope(sig.kind,{...sig,to:sig.to,conversationId:state.conversationId})})}
  async function makePeer(){
    const pc=new RTCPeerConnection({iceServers:ICE(),iceCandidatePoolSize:8});state.pc=pc;state.remoteStream=new MediaStream();
    if(state.stream)state.stream.getTracks().forEach(t=>pc.addTrack(t,state.stream));
    pc.onicecandidate=e=>{if(e.candidate)send({kind:'ice',candidate:e.candidate.toJSON(),to:state.peerId}).catch(err=>console.warn('[AUXY_CALL] ice',err))};
    pc.ontrack=e=>{e.streams?.[0]?.getTracks?.().forEach(t=>state.remoteStream.addTrack(t));const v=state.overlay?.querySelector('#call-remote');if(v){v.srcObject=state.remoteStream;v.play().catch(()=>{})}};
    pc.onconnectionstatechange=()=>{if(['failed','closed','disconnected'].includes(pc.connectionState)){if(pc.connectionState==='failed')UI().toast('ارتباط تماس قطع شد.','error');if(pc.connectionState!=='disconnected')endCall(false)}};
    return pc;
  }
  async function start(type,conversationId,peerId){
    if(!conversationId||!peerId)throw new Error('مخاطب تماس مشخص نیست.');
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('مرورگر شما تماس صوتی/تصویری را پشتیبانی نمی‌کند یا اتصال امن نیست.');
    if(state.pc)await endCall(false);
    state.conversationId=conversationId;state.peerId=peerId;state.callId=crypto.randomUUID();state.type=type;state.role='caller';state.closed=false;
    state.stream=await navigator.mediaDevices.getUserMedia(type==='video'?{audio:true,video:{facingMode:'user'}}:{audio:true,video:false});
    await makePeer();showOverlay('outgoing');
    const offer=await state.pc.createOffer({offerToReceiveAudio:true,offerToReceiveVideo:type==='video'});await state.pc.setLocalDescription(offer);
    await send({kind:'offer',sdp:state.pc.localDescription,to:peerId,type});
  }
  async function acceptIncoming(){
    if(!state.pendingOffer)return;
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('مرورگر شما تماس را پشتیبانی نمی‌کند یا اتصال امن نیست.');
    state.role='callee';state.peerId=state.pendingOffer.from;state.callId=state.pendingOffer.callId;state.conversationId=state.pendingOffer.conversationId||state.conversationId;state.type=state.pendingOffer.type||'audio';
    state.stream=await navigator.mediaDevices.getUserMedia(state.type==='video'?{audio:true,video:{facingMode:'user'}}:{audio:true,video:false});
    await makePeer();
    await state.pc.setRemoteDescription(new RTCSessionDescription(state.pendingOffer.sdp));
    for(const c of state.queuedIce){try{await state.pc.addIceCandidate(c)}catch{}} state.queuedIce=[];
    const answer=await state.pc.createAnswer();await state.pc.setLocalDescription(answer);showOverlay('connected');
    await send({kind:'answer',sdp:state.pc.localDescription,to:state.peerId});state.pendingOffer=null;
  }
  async function rejectIncoming(){if(!state.pendingOffer)return;try{await send({kind:'reject',to:state.pendingOffer.from})}catch{};state.pendingOffer=null;clearOverlay();state.callId=null;state.peerId=null}
  async function endCall(notify=true){if(notify&&state.peerId&&state.callId){try{await send({kind:'end',to:state.peerId})}catch{}};try{state.pc?.close()}catch{};state.pc=null;resetMedia();clearOverlay();state.conversationId=null;state.peerId=null;state.callId=null;state.role=null;state.type=null;state.pendingOffer=null}
  async function handleSignal(msg){
    if(!msg||msg.from===state.me?.id||msg.to&&msg.to!==state.me?.id)return;
    const conv=msg.conversationId||msg.convId||null;
    if(msg.kind==='offer'){
      if(state.pc||state.pendingOffer)return;
      state.conversationId=conv||state.conversationId;state.peerId=msg.from;state.callId=msg.callId;state.type=msg.type||'audio';state.pendingOffer=msg;showOverlay('incoming');return;
    }
    if(msg.callId&&state.callId&&msg.callId!==state.callId)return;
    if(msg.kind==='answer'&&state.pc){await state.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));for(const c of state.queuedIce){try{await state.pc.addIceCandidate(c)}catch{}}state.queuedIce=[];if(state.overlay?.querySelector('.call-stage')&&state.type==='video')showOverlay('connected');return}
    if(msg.kind==='ice'&&state.pc){try{const c=new RTCIceCandidate(msg.candidate);if(state.pc.remoteDescription)await state.pc.addIceCandidate(c);else state.queuedIce.push(c)}catch(e){console.warn('[AUXY_CALL] candidate',e)}return}
    if(msg.kind==='reject'||msg.kind==='end'){UI().toast(msg.kind==='reject'?'تماس رد شد.':'تماس پایان یافت.','info');await endCall(false)}
  }
  function bindConversation(conv){return room(conv)}
  function setMe(me){state.me=me}
  window.AUXY_CALLS={setMe,watch,bindConversation,start,end:endCall};
})();
