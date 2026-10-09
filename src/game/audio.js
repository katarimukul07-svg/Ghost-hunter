/* Music: licensed CC0 tracks plus original code-generated styles. Effects use a separate bus. */
const Sound = (() => {
  let ctx, master, music, synth, effects, limiter, timer=null, muted=false, musicSource=null, musicEpoch=0;
  let schedulerId=null, procedural=null, playingId=null;
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
      synth=ctx.createGain(); synth.gain.value=0.4; synth.connect(music);
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
  function kick(t,vol){ voice(150,0.14,"sine",vol,synth,t,42); }
  function hat(t,vol){ voice(7040,0.025,"square",vol,synth,t,5200); }
  const STYLES={
    // Melodic EDM, 124 BPM, E minor: plucked four-note hook over a warm bass.
    "neon-rush":{bpm:124, roots:[82.41,65.41,98,73.42], motif:[659.25,783.99,987.77,739.99],
      play(n,t,root,s){
        if(n%4===0) kick(t,0.2);
        if(n%2===1) hat(t,0.018);
        if(n%4===2) voice(root,0.28,"triangle",0.2,synth,t);
        if(n%8===0) voice(root*2,0.9,"sine",0.06,synth,t);
        if(n%8===3 || n%8===6) voice(s.motif[Math.floor(n/8)],0.16,"triangle",0.1,synth,t);
        if(intensity>=1 && n%8===7) voice(s.motif[(Math.floor(n/8)+1)%4]*2,0.1,"sine",0.06,synth,t);
        if(intensity>=2 && n%2===0) voice(root*4,0.05,"triangle",0.035,synth,t);
      }},
    // Driving techno, 132 BPM, D minor: four-on-the-floor kick and a bell motif.
    "night-drive":{bpm:132, roots:[73.42,58.27,87.31,65.41], motif:[587.33,698.46,880,523.25],
      play(n,t,root,s){
        if(n%2===0) kick(t,0.22);
        if(n%2===1) hat(t,0.022);
        if(n%4===1 || n%4===3) voice(root,0.12,"triangle",0.17,synth,t);
        if(n%16===4 || n%16===10) voice(s.motif[Math.floor(n/8)],0.35,"sine",0.09,synth,t);
        if(intensity>=1 && n%8===6) voice(s.motif[Math.floor(n/8)]*1.5,0.12,"sine",0.05,synth,t);
        if(intensity>=2 && n%4===2) voice(root*8,0.04,"square",0.012,synth,t);
      }},
    // Acid techno, 138 BPM, A minor: gliding saw bass under the original ghost motif.
    "acid-chase":{bpm:138, roots:[55,43.65,65.41,49], motif:[440,523.25,659.25,493.88],
      play(n,t,root,s){
        if(n%2===0) kick(t,0.2);
        if(n%2===1) hat(t,0.02);
        const acid=[1,1,2,1,1.5,1,2,1.33][n%8];
        voice(root*2*acid,0.11,"sawtooth",0.045,synth,t,root*2*acid*(n%3===0?1.5:1));
        if(n%8===2 || n%8===6) voice(s.motif[Math.floor(n/8)],0.18,"sine",0.11,synth,t);
        if(intensity>=1 && n%8===7) voice(root*4,0.1,"triangle",0.07,synth,t);
        if(intensity>=2 && n%4===3) voice(s.motif[(Math.floor(n/8)+2)%4]*2,0.06,"sine",0.04,synth,t);
      }},
  };
  function schedule(){
    if(!ctx || timer===null || muted || !procedural) return;
    if(ctx.state!=="running"){ nextBeat=ctx.currentTime+0.03; return; }
    if(nextBeat<ctx.currentTime) nextBeat=ctx.currentTime+0.03;
    const s=STYLES[procedural];
    while(nextBeat<ctx.currentTime+0.12){
      const n=step%32, root=s.roots[Math.floor(n/8)];
      s.play(n,nextBeat,root,s);
      step++; nextBeat+=60/s.bpm/2;
    }
  }
  function stopAmbient(){
    musicEpoch++;
    if(schedulerId!==null) clearInterval(schedulerId);
    schedulerId=null; timer=null; procedural=null; playingId=null;
    if(musicSource){try{musicSource.stop();}catch(e){}musicSource.disconnect();musicSource=null;}
    for(const source of voices){try{source.stop();}catch(e){}}
    status("");
  }
  // Plays one track: a bundled file (track.src) or a code-generated style.
  async function play(id){
    unlock(); if(!ctx) return;
    if(timer!==null && playingId===id) return;
    if(timer!==null) stopAmbient();
    timer=true; playingId=id; const epoch=++musicEpoch; const track=trackById(id);
    if(muted){status("Sound is off. Turn it on to preview.");return;}
    music.gain.cancelScheduledValues(ctx.currentTime);music.gain.setValueAtTime(0,ctx.currentTime);
    music.gain.linearRampToValueAtTime(musicLevel*0.7,ctx.currentTime+0.4);
    if(!track.src){
      procedural=track.id; step=0; nextBeat=ctx.currentTime+0.03;
      schedulerId=setInterval(schedule,25); schedule(); status(track.label); return;
    }
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
    unlock,startAmbient,startMenuMusic,stopAmbient,pickup,complete,death,setMusic,musicTrack:()=>trackId,
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
      }else if(playingId!==null){const id=playingId;stopAmbient();play(id);}
    },
    isMuted:()=>muted,setLevels,
    levels:()=>({music:musicLevel,effects:effectsLevel}),
  };
  if(new URLSearchParams(location.search).has("test"))
    Object.defineProperty(window,"__ghostAudioTest",{value:{
      acceptsMusicResponse,
      snapshot:()=>({musicActive:!muted && (musicSource!==null || procedural!==null),playingId,trackId,running:timer!==null,voices:voices.size,intensity,step,muted,levels:api.levels()}),
    }});
  return api;
})();
