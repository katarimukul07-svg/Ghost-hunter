/* Original procedural score: no downloaded tracks or runtime network requests. */
const Sound = (() => {
  let ctx, master, music, effects, limiter, timer=null, muted=false;
  let packId=SOUND_PACKS[0].id, intensity=0, step=0, nextBeat=0;
  const read=key=>{try{return localStorage.getItem(key);}catch(e){return null;}};
  let musicLevel=Number(read("echoSteps.musicLevel") ?? 0.55);
  let effectsLevel=Number(read("echoSteps.effectsLevel") ?? 0.8);
  const voices=new Set();
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
      master.gain.value=muted?0:0.7; music.gain.value=musicLevel*0.28; effects.gain.value=effectsLevel;
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
    const t=ctx.currentTime, target=musicLevel*0.28;
    music.gain.cancelScheduledValues(t); music.gain.setTargetAtTime(target*0.35,t,0.015);
    music.gain.setTargetAtTime(target,t+0.25,0.12);
  }
  function cue(notes,type="sine",vol=0.13){
    if(!ctx || muted) return;
    duck();
    notes.forEach(([f,d,delay=0,glide])=>voice(f,d,type,vol,effects,ctx.currentTime+delay,glide));
  }
  // 112 BPM, A minor: sparse bass + a recognizable four-note ghost motif.
  // Added pulse and octave response enter on beat boundaries as rounds advance.
  function schedule(){
    if(!ctx || timer===null) return;
    if(ctx.state!=="running"){ nextBeat=ctx.currentTime+0.03; return; }
    if(nextBeat<ctx.currentTime) nextBeat=ctx.currentTime+0.03;
    while(nextBeat<ctx.currentTime+0.12){
      const n=step%32, roots=[110,87.31,130.81,98], root=roots[Math.floor(n/8)];
      if(n%4===0) voice(root,0.36,"triangle",0.22,music,nextBeat);
      if(n%8===0) voice(root*2,0.7,"sine",0.08,music,nextBeat);
      if(n%8===2 || n%8===6){
        const motif=[440,523.25,659.25,493.88];
        voice(motif[Math.floor(n/8)],0.18,"sine",0.12,music,nextBeat);
      }
      if(intensity>=1 && n%2===0) voice(220,0.06,"triangle",0.045,music,nextBeat,110);
      if(intensity>=2 && n%8===7) voice(root*4,0.1,"triangle",0.07,music,nextBeat);
      step++; nextBeat+=60/112/2;
    }
  }
  function stopAmbient(){
    if(timer!==null) clearInterval(timer);
    timer=null;
    // Cancel future notes and effect tails on pause/menu/background transitions.
    for(const source of voices){ try{source.stop();}catch(e){} }
  }
  function startAmbient(){
    unlock(); if(!ctx || timer!==null) return;
    step=0; nextBeat=ctx.currentTime+0.03;
    timer=setInterval(schedule,25); schedule();
  }
  function setLevels(m,e){
    musicLevel=clamp(m); effectsLevel=clamp(e);
    ss("echoSteps.musicLevel",String(musicLevel)); ss("echoSteps.effectsLevel",String(effectsLevel));
    if(ctx){
      music.gain.cancelScheduledValues(ctx.currentTime);
      music.gain.setTargetAtTime(musicLevel*0.28,ctx.currentTime,0.03);
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
    unlock,startAmbient,stopAmbient,pickup,complete,death,
    bonus(){cue([[659.25,0.09],[880,0.14,0.07]],"sine",0.12);},
    sweep(){const p=pack(); cue([[p.sweepFreq,CFG.SWEEP_TIME,0,p.sweepFreq*4]],"triangle",0.1);},
    previewPack(){pickup(); complete();},
    setPack(id){packId=id;},
    setRound(value){intensity=value>=10?2:value>=5?1:0;},
    setMuted(m){
      muted=!!m;
      if(ctx) master.gain.setTargetAtTime(muted?0:0.7,ctx.currentTime,0.02);
      if(muted) for(const source of voices){try{source.stop();}catch(e){}}
    },
    isMuted:()=>muted,setLevels,
    levels:()=>({music:musicLevel,effects:effectsLevel}),
  };
  if(new URLSearchParams(location.search).has("test"))
    Object.defineProperty(window,"__ghostAudioTest",{value:{
      snapshot:()=>({running:timer!==null,voices:voices.size,intensity,step,muted,levels:api.levels()}),
    }});
  return api;
})();
