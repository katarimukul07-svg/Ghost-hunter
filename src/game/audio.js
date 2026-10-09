/* Music: CC0 tracks (assets/music/LICENSES.md). Effects are synthwave voices generated in code on a separate bus. */
const Sound = (() => {
  let ctx, master, music, effects, limiter, noise=null, timer=null, muted=false, musicSource=null, musicEpoch=0;
  let playingId=null, intensity=0;
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
  function duck(){
    if(!ctx) return;
    const t=ctx.currentTime, target=musicLevel*0.7;
    music.gain.cancelScheduledValues(t); music.gain.setTargetAtTime(target*0.35,t,0.015);
    music.gain.setTargetAtTime(target,t+0.25,0.12);
  }
  // iOS Capacitor returns URLResponse (not HTTPURLResponse) for bundled media.
  // WebKit exposes a successful local response with status 0 and ok=false.
  const acceptsMusicResponse=(response,source)=>response.ok ||
    (response.status===0 && new URL(source,location.href).protocol==="capacitor:");
  const trackById=id=>MUSIC_TRACKS.find(t=>t.id===id) || MENU_TRACK;
  // Encoders pad compressed audio with silence; start and end the loop on sound
  // so looping tracks don't stutter at the seam.
  function soundBounds(buffer){
    const data=buffer.getChannelData(0), limit=0.0015;
    let a=0,b=data.length-1;
    while(a<b && Math.abs(data[a])<limit) a++;
    while(b>a && Math.abs(data[b])<limit) b--;
    return {start:a/buffer.sampleRate, end:(b+1)/buffer.sampleRate};
  }
  async function loadTrack(id){
    if(buffers.has(id))return buffers.get(id);
    const track=trackById(id);
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
    musicEpoch++;
    timer=null; playingId=null;
    if(musicSource){try{musicSource.stop();}catch(e){}musicSource.disconnect();musicSource=null;}
    for(const source of voices){try{source.stop();}catch(e){}}
    status("");
  }
  // Plays one bundled track on a seamless loop.
  async function play(id){
    unlock(); if(!ctx) return;
    if(timer!==null && playingId===id) return;
    if(timer!==null) stopAmbient();
    timer=true; playingId=id; const epoch=++musicEpoch; const track=trackById(id);
    if(muted){status("Sound is off. Turn it on to preview.");return;}
    music.gain.cancelScheduledValues(ctx.currentTime);music.gain.setValueAtTime(0,ctx.currentTime);
    music.gain.linearRampToValueAtTime(musicLevel*0.7,ctx.currentTime+0.4);
    status("Loading music…");
    try{
      const buffer=await loadTrack(id);
      if(epoch!==musicEpoch || timer===null || muted)return;
      const bounds=soundBounds(buffer);
      const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;
      source.loopStart=bounds.start;source.loopEnd=bounds.end;
      source.connect(music);musicSource=source;
      source.start(0,bounds.start);status(track.label);
    }catch(e){if(epoch===musicEpoch){timer=null;playingId=null;status("Music unavailable. Tap a track to retry.");}}
  }
  function startAmbient(){ return play(trackId); }
  function startMenuMusic(){ return play(MENU_TRACK.id); }
  function setMusic(id){
    if(!MUSIC_TRACKS.some(t=>t.id===id))return;
    stopAmbient();trackId=id;ss("echoSteps.musicTrack",id);
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
  // Synthwave effects in A minor (Neon House is in C major / A minor): detuned saw plucks
  // through a closing low-pass filter, a filtered-noise riser and a falling bass.
  const N={a1:55,a2:110,e3:164.81,a3:220,a4:440,c5:523.25,e5:659.25,a5:880,c6:1046.5,e6:1318.51};
  function track(node){
    voices.add(node);
    node.onended=()=>{voices.delete(node);node.disconnect();};
  }
  function synthVoice(freq,dur,{when=0,vol=0.1,type="sawtooth",detune=9,cutoff=3200,cutoffEnd=500,glide,q=4}={}){
    if(!ctx || muted || voices.size>=46) return;
    const t=ctx.currentTime+when, f=ctx.createBiquadFilter(), g=ctx.createGain();
    f.type="lowpass"; f.Q.value=q;
    f.frequency.setValueAtTime(cutoff,t); f.frequency.exponentialRampToValueAtTime(Math.max(60,cutoffEnd),t+dur);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.006);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    f.connect(g); g.connect(effects);
    let left=2;
    for(const cents of [-detune,detune]){
      const o=ctx.createOscillator(); o.type=type; o.detune.value=cents;
      o.frequency.setValueAtTime(freq,t); if(glide) o.frequency.exponentialRampToValueAtTime(glide,t+dur);
      o.connect(f); voices.add(o);
      o.onended=()=>{voices.delete(o);o.disconnect();if(--left===0){f.disconnect();g.disconnect();}};
      o.start(t); o.stop(t+dur+0.02);
    }
  }
  function riser(dur){
    if(!ctx || muted) return;
    if(!noise){
      noise=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
      const d=noise.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    }
    const t=ctx.currentTime, src=ctx.createBufferSource(), f=ctx.createBiquadFilter(), g=ctx.createGain();
    src.buffer=noise; src.loop=true; f.type="bandpass"; f.Q.value=6;
    f.frequency.setValueAtTime(400,t); f.frequency.exponentialRampToValueAtTime(5000,t+dur);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.09,t+dur*0.8);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    src.connect(f); f.connect(g); g.connect(effects); voices.add(src);
    src.onended=()=>{voices.delete(src);src.disconnect();f.disconnect();g.disconnect();};
    src.start(t); src.stop(t+dur+0.02);
  }
  function pickup(){
    if(!ctx || muted) return; duck();
    synthVoice(N.e5,0.14,{vol:0.07,cutoff:4200,cutoffEnd:700});
    synthVoice(N.a5,0.1,{when:0.035,vol:0.04,type:"triangle",detune:4,cutoff:6000,cutoffEnd:1500});
  }
  function bonus(){
    if(!ctx || muted) return; duck();
    synthVoice(N.c6,0.12,{vol:0.06,cutoff:5000,cutoffEnd:900});
    synthVoice(N.e6,0.22,{when:0.07,vol:0.06,cutoff:5500,cutoffEnd:900});
  }
  function complete(){
    if(!ctx || muted) return; duck();
    [N.a4,N.c5,N.e5,N.a5].forEach((f,i)=>synthVoice(f,i===3?0.4:0.14,{when:i*0.055,vol:0.06,cutoff:4500,cutoffEnd:i===3?400:800}));
    synthVoice(N.a3,0.5,{when:0.17,vol:0.05,type:"triangle",detune:6,cutoff:1800,cutoffEnd:300});
  }
  function sweep(){
    if(!ctx || muted) return; duck();
    riser(CFG.SWEEP_TIME);
    synthVoice(N.a2,CFG.SWEEP_TIME,{vol:0.05,cutoff:400,cutoffEnd:3500,glide:N.a3,q:8});
  }
  function death(){
    stopAmbient();
    if(!ctx || muted) return;
    synthVoice(N.e3,0.75,{vol:0.1,cutoff:2400,cutoffEnd:120,glide:N.e3/2,q:6});
    synthVoice(N.a2,0.8,{vol:0.08,cutoff:1800,cutoffEnd:100,glide:N.a1,detune:14});
    voice(110,0.45,"sine",0.18,effects,ctx.currentTime,40);
  }
  const api={
    unlock,startAmbient,startMenuMusic,stopAmbient,pickup,complete,death,bonus,sweep,setMusic,musicTrack:()=>trackId,
    previewPack(){pickup(); setTimeout(complete,250); setTimeout(bonus,700);},
    setPack(){}, // one effects style; kept so saved settings stay compatible
    setRound(value){intensity=value>=10?2:value>=5?1:0;},
    setMuted(m){
      muted=!!m;
      if(ctx) master.gain.setTargetAtTime(muted?0:0.7,ctx.currentTime,0.02);
      if(muted){
        musicEpoch++;if(musicSource){try{musicSource.stop();}catch(e){}musicSource.disconnect();musicSource=null;}
        for(const source of voices){try{source.stop();}catch(e){}}
      }else if(playingId!==null){const id=playingId;stopAmbient();play(id);}
    },
    isMuted:()=>muted,setLevels,
    levels:()=>({music:musicLevel,effects:effectsLevel}),
  };
  if(new URLSearchParams(location.search).has("test"))
    Object.defineProperty(window,"__ghostAudioTest",{value:{
      acceptsMusicResponse,
      snapshot:()=>({musicActive:!muted && musicSource!==null,playingId,trackId,running:timer!==null,voices:voices.size,intensity,muted,levels:api.levels()}),
    }});
  return api;
})();
