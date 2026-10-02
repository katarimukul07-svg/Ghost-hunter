/* Bundled instrumental tracks; procedural gameplay cues use a separate bus. */
const Sound = (() => {
  let ctx, master, music, effects, limiter, timer=null, muted=false, musicSource=null, musicEpoch=0;
  let packId=SOUND_PACKS[0].id, intensity=0, step=0, nextBeat=0;
  const read=key=>{try{return localStorage.getItem(key);}catch(e){return null;}};
  let musicLevel=Number(read("echoSteps.musicLevel") ?? 0.55);
  let effectsLevel=Number(read("echoSteps.effectsLevel") ?? 0.8);
  let trackId=read("echoSteps.musicTrack");
  if(!MUSIC_TRACKS.some(t=>t.id===trackId))trackId=MUSIC_TRACKS[0].id;
  const buffers=new Map();
  const voices=new Set();
  const status=text=>window.dispatchEvent(new CustomEvent("ghost:music-status",{detail:text}));
  const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(Number(v))?Number(v):0.5));
  musicLevel=clamp(musicLevel); effectsLevel=clamp(effectsLevel);
  function ensure(){
    if(ctx) return;
    const AC=window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    try {
      ctx=new AC(); master=ctx.createGain(); music=ctx.createGain(); effects=ctx.createGain();
      limiter=ctx.createDynamicsCompressor();
      limiter.threshold.value=-10; limiter.knee.value=6; limiter.ratio.value=12;
      limiter.attack.value=0.003; limiter.release.value=0.15;
      music.connect(master); effects.connect(master); master.connect(limiter); limiter.connect(ctx.destination);
      master.gain.value=muted?0:0.7; music.gain.value=musicLevel*0.7; effects.gain.value=effectsLevel;
    } catch(e){ ctx=null; }
  }
  function unlock(){ ensure(); if(ctx?.state==="suspended") ctx.resume().catch(()=>{}); }
  function voice(freq,dur,type,vol,bus,when,glide){
    if(!ctx || muted || voices.size>=48) return;
    const t=when ?? ctx.currentTime, o=ctx.createOscillator(), g=ctx.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,t);
    if(glide) o.frequency.exponentialRampToValueAtTime(glide,t+dur);
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001,vol),t+0.008);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g); g.connect(bus); voices.add(o);
    o.onended=()=>{ voices.delete(o); o.disconnect(); g.disconnect(); };
    o.start(t); o.stop(t+dur+0.02);
  }
  const pack=()=>SOUND_PACKS.find(p=>p.id===packId) || SOUND_PACKS[0];
  function duck(){
    if(!ctx) return;
    const t=ctx.currentTime, target=musicLevel*0.7;
    music.gain.cancelScheduledValues(t); music.gain.setTargetAtTime(target*0.35,t,0.015);
    music.gain.setTargetAtTime(target,t+0.25,0.12);
  }
  function cue(notes,type="sine",vol=0.13){
    if(!ctx || muted) return;
    duck();
    notes.forEach(([f,d,delay=0,glide])=>voice(f,d,type,vol,effects,ctx.currentTime+delay,glide));
  }
  // iOS Capacitor returns URLResponse (not HTTPURLResponse) for bundled media.
  // WebKit exposes a successful local response with status 0 and ok=false.
  const acceptsMusicResponse=(response,source)=>response.ok ||
    (response.status===0 && new URL(source,location.href).protocol==="capacitor:");
  async function loadTrack(id){
    if(buffers.has(id))return buffers.get(id);
    const track=MUSIC_TRACKS.find(t=>t.id===id);
    const pending=(async()=>{
      let response;
      try{response=await fetch(track.src);if(!acceptsMusicResponse(response,track.src))throw new Error("Music unavailable");}
      catch(error){response=typeof caches!=="undefined"?await caches.match(track.src):null;if(!response)throw error;}
      return ctx.decodeAudioData(await response.arrayBuffer());
    })();
    buffers.set(id,pending);
    try{return await pending;}catch(error){buffers.delete(id);throw error;}
  }
  function stopAmbient(){
    musicEpoch++;timer=null;
    if(musicSource){try{musicSource.stop();}catch(e){}musicSource.disconnect();musicSource=null;}
    for(const source of voices){try{source.stop();}catch(e){}}
    status("");
  }
  async function startAmbient(){
    unlock();if(!ctx || timer!==null)return;
    timer=true;const epoch=++musicEpoch;step++;
    if(muted){status("Sound is off. Turn it on to preview.");return;}
    status("Loading music…");
    try{
      const buffer=await loadTrack(trackId);
      if(epoch!==musicEpoch || timer===null || muted)return;
      const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(music);musicSource=source;
      music.gain.cancelScheduledValues(ctx.currentTime);music.gain.setValueAtTime(0,ctx.currentTime);music.gain.linearRampToValueAtTime(musicLevel*0.7,ctx.currentTime+0.15);
      source.start();status(MUSIC_TRACKS.find(t=>t.id===trackId).label);
    }catch(e){if(epoch===musicEpoch){timer=null;status("Music unavailable. Tap a track to retry.");}}
  }
  function setMusic(id){
    if(!MUSIC_TRACKS.some(t=>t.id===id))return;
    stopAmbient();buffers.clear();trackId=id;ss("echoSteps.musicTrack",id);
  }
  function setLevels(m,e){
    musicLevel=clamp(m); effectsLevel=clamp(e);
    ss("echoSteps.musicLevel",String(musicLevel)); ss("echoSteps.effectsLevel",String(effectsLevel));
    if(ctx){
      music.gain.cancelScheduledValues(ctx.currentTime);
      music.gain.setTargetAtTime(musicLevel*0.7,ctx.currentTime,0.03);
      effects.gain.setTargetAtTime(effectsLevel,ctx.currentTime,0.03);
    }
  }
  function pickup(){const p=pack(); cue([[p.pickup.freq,p.pickup.dur||0.09]],p.pickup.type);}
  function complete(){
    const p=pack(), [a,b]=p.complete;
    cue([[a.freq,0.1]],a.type);
    voice(b.freq,0.16,b.type,0.14,effects,ctx?.currentTime+0.1);
  }
  function death(){
    stopAmbient();
    cue([[180,0.65,0,70],[191,0.55,0,76],[269,0.5,0,107]],"triangle",0.12);
    cue([[220,0.18,0,90]],"sawtooth",0.06);
  }
  const api={
    unlock,startAmbient,stopAmbient,pickup,complete,death,setMusic,musicTrack:()=>trackId,
    bonus(){cue([[659.25,0.09],[880,0.14,0.07]],"sine",0.12);},
    sweep(){const p=pack(); cue([[p.sweepFreq,CFG.SWEEP_TIME,0,p.sweepFreq*4]],"triangle",0.1);},
    previewPack(){pickup(); complete();},
    setPack(id){packId=id;},
    setRound(value){intensity=value>=10?2:value>=5?1:0;},
    setMuted(m){
      muted=!!m;
      if(ctx) master.gain.setTargetAtTime(muted?0:0.7,ctx.currentTime,0.02);
      if(muted){
        musicEpoch++;if(musicSource){try{musicSource.stop();}catch(e){}musicSource.disconnect();musicSource=null;}
        for(const source of voices){try{source.stop();}catch(e){}}
      }else if(timer!==null){timer=null;startAmbient();}
    },
    isMuted:()=>muted,setLevels,
    levels:()=>({music:musicLevel,effects:effectsLevel}),
  };
  if(new URLSearchParams(location.search).has("test"))
    Object.defineProperty(window,"__ghostAudioTest",{value:{
      acceptsMusicResponse,
      snapshot:()=>({musicActive:musicSource!==null,trackId,running:timer!==null,voices:voices.size,intensity,step,muted,levels:api.levels()}),
    }});
  return api;
})();
