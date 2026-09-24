/* ---------- Audio (synthesized) ---------- */
const Sound = (function () {
  let ctx=null, master=null, ambient=null, muted=false, packId=SOUND_PACKS[0].id;
  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC(); master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);
  }
  function getPack(){ return SOUND_PACKS.find(p=>p.id===packId) || SOUND_PACKS[0]; }
  function tone(freq,dur,type,vol,glideTo) {
    if (!ctx || muted) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq,t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t+dur);
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(vol, t+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t+dur+0.03);
  }
  function noiseBuffer(dur) {
    const size = Math.max(1, Math.floor(ctx.sampleRate*dur));
    const buf = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i=0;i<size;i++) data[i] = Math.random()*2-1;
    return buf;
  }
  /* Dedicated horror stinger for death: sub-bass rumble + a dissonant
     detuned cluster pitching down + a swept noise "gasp". Always plays this
     regardless of the selected sound pack, so death always reads as scary. */
  function scaryDeath() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;

    const rumble = ctx.createOscillator(), rGain = ctx.createGain();
    rumble.type = "sine";
    rumble.frequency.setValueAtTime(90, t);
    rumble.frequency.exponentialRampToValueAtTime(32, t + 1.1);
    rGain.gain.setValueAtTime(0.0001, t);
    rGain.gain.exponentialRampToValueAtTime(0.38, t + 0.05);
    rGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    rumble.connect(rGain); rGain.connect(master);
    rumble.start(t); rumble.stop(t + 1.25);

    [190, 201, 269].forEach(f => {   // dissonant cluster (minor 2nd + tritone-ish spread)
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.4, t + 0.9);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.95);
    });

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(0.6);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.Q.value = 6;
    bp.frequency.setValueAtTime(2400, t);
    bp.frequency.exponentialRampToValueAtTime(200, t + 0.6);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.0001, t);
    nGain.gain.exponentialRampToValueAtTime(0.28, t + 0.03);
    nGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    noise.connect(bp); bp.connect(nGain); nGain.connect(master);
    noise.start(t); noise.stop(t + 0.65);
  }
  function startAmbient() {
    ensure(); if (ctx.state === "suspended") ctx.resume();
    if (ambient) return;
    const o1=ctx.createOscillator(), o2=ctx.createOscillator();
    const filt=ctx.createBiquadFilter(), g=ctx.createGain();
    const lfo=ctx.createOscillator(), lfoGain=ctx.createGain();
    o1.type="sawtooth"; o2.type="sawtooth"; o1.frequency.value=55; o2.frequency.value=55*1.008;
    filt.type="lowpass"; filt.frequency.value=300; filt.Q.value=7; g.gain.value=0.05;
    lfo.frequency.value=0.14; lfoGain.gain.value=0.035;
    lfo.connect(lfoGain); lfoGain.connect(g.gain);
    o1.connect(filt); o2.connect(filt); filt.connect(g); g.connect(master);
    o1.start(); o2.start(); lfo.start(); ambient={o1,o2,lfo,g};
  }
  function stopAmbient() {
    if (!ambient) return; const a=ambient; ambient=null;
    try { a.g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.3); } catch(e){}
    setTimeout(()=>{ try{ a.o1.stop(); a.o2.stop(); a.lfo.stop(); }catch(e){} }, 380);
  }
  function pickupSound(){ const p=getPack(); tone(p.pickup.freq, p.pickup.dur||0.09, p.pickup.type, 0.16); }
  function completeSound(){
    const p=getPack(), [a,b]=p.complete;
    tone(a.freq, a.dur||0.10, a.type, 0.18);
    setTimeout(()=>tone(b.freq, b.dur||0.14, b.type, 0.18), 95);
  }
  function sweepSound(){ const p=getPack(); tone(p.sweepFreq, CFG.SWEEP_TIME, p.sweepType, 0.10, p.sweepFreq*4); }
  function previewPack(){ pickupSound(); setTimeout(completeSound, 160); }
  return {
    unlock(){ ensure(); if (ctx.state==="suspended") ctx.resume(); },
    setMuted(m){ muted=m; if (master) master.gain.value = m?0:0.9; },
    isMuted(){ return muted; },
    setPack(id){ packId = id; },
    pickup: pickupSound,
    complete: completeSound,
    sweep: sweepSound,
    death(){ scaryDeath(); },
    previewPack,
    startAmbient, stopAmbient,
  };
})();
"use strict";
