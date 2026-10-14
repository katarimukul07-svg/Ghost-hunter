/* ---------- Render ---------- */
function glow(targetCtx,x,y,r,color,alpha){
  targetCtx.globalAlpha = 0.22*alpha; targetCtx.fillStyle = color;
  targetCtx.beginPath(); targetCtx.arc(x,y,r*2.1,0,Math.PI*2); targetCtx.fill();
  targetCtx.globalAlpha = 0.92*alpha;
  targetCtx.beginPath(); targetCtx.arc(x,y,r,0,Math.PI*2); targetCtx.fill();
  targetCtx.globalAlpha = 1;
}
/* Renders a player skin by style — each one reads as a distinct shape, not
   just a recolored dot. Shared by the live game and the shop preview panel. */
function drawSkin(targetCtx, x, y, r, color, style, alpha, tSec){
  switch (style){
    case "ring": {
      targetCtx.save(); targetCtx.globalAlpha = 0.9*alpha; targetCtx.strokeStyle = color;
      targetCtx.shadowColor = color; targetCtx.shadowBlur = 14; targetCtx.lineWidth = Math.max(2,r*0.32);
      targetCtx.beginPath(); targetCtx.arc(x,y,r*0.78,0,Math.PI*2); targetCtx.stroke();
      targetCtx.restore();
      break;
    }
    case "pulse": {
      const p = 1 + Math.sin(tSec*4)*0.35;
      targetCtx.save(); targetCtx.globalAlpha = 0.35*alpha; targetCtx.strokeStyle = color; targetCtx.lineWidth = 2;
      targetCtx.beginPath(); targetCtx.arc(x,y,r*1.7*p,0,Math.PI*2); targetCtx.stroke();
      targetCtx.restore();
      glow(targetCtx, x, y, r*0.75, color, alpha);
      break;
    }
    case "comet": {
      const spikes = 5, outer = r*1.15, inner = r*0.45;
      targetCtx.save(); targetCtx.globalAlpha = alpha; targetCtx.fillStyle = color;
      targetCtx.shadowColor = color; targetCtx.shadowBlur = 16;
      targetCtx.translate(x,y); targetCtx.rotate(tSec*3);
      targetCtx.beginPath();
      for (let i=0;i<spikes*2;i++){
        const rad = i%2===0 ? outer : inner, ang = (Math.PI/spikes)*i;
        const px = Math.cos(ang)*rad, py = Math.sin(ang)*rad;
        i===0 ? targetCtx.moveTo(px,py) : targetCtx.lineTo(px,py);
      }
      targetCtx.closePath(); targetCtx.fill();
      targetCtx.restore();
      break;
    }
    case "square": {
      const s = r*1.5;
      targetCtx.save(); targetCtx.globalAlpha = alpha; targetCtx.fillStyle = color;
      targetCtx.shadowColor = color; targetCtx.shadowBlur = 16;
      targetCtx.translate(x,y); targetCtx.rotate(Math.PI/4 + tSec*0.6);
      targetCtx.beginPath(); targetCtx.roundRect(-s/2,-s/2,s,s,r*0.3); targetCtx.fill();
      targetCtx.restore();
      break;
    }
    case "void": {
      targetCtx.save();
      targetCtx.globalAlpha = 0.95*alpha; targetCtx.strokeStyle = color;
      targetCtx.shadowColor = color; targetCtx.shadowBlur = 18; targetCtx.lineWidth = Math.max(2,r*0.35);
      targetCtx.beginPath(); targetCtx.arc(x,y,r*0.85,0,Math.PI*2); targetCtx.stroke();
      targetCtx.globalAlpha = 0.92*alpha; targetCtx.fillStyle = C.bg || "#070b10";
      targetCtx.beginPath(); targetCtx.arc(x,y,r*0.55,0,Math.PI*2); targetCtx.fill();
      targetCtx.restore();
      break;
    }
    default:
      glow(targetCtx, x, y, r, color, alpha);
  }
}
function drawGrid(target=ctx){
  target.strokeStyle=C.grid; target.lineWidth=1; const gap=40; target.beginPath();
  for (let x=room.x;x<=room.x+room.w;x+=gap){ target.moveTo(x,room.y); target.lineTo(x,room.y+room.h); }
  for (let y=room.y;y<=room.y+room.h;y+=gap){ target.moveTo(room.x,y); target.lineTo(room.x+room.w,y); }
  target.stroke();
}
function drawRoomBorder(target=ctx){
  target.save(); target.strokeStyle=C.border; target.globalAlpha=0.5;
  target.shadowColor=C.border; target.shadowBlur=10; target.lineWidth=2;
  target.strokeRect(room.x,room.y,room.w,room.h); target.restore();
}
// Background, grid and glowing border only change when the room or theme does,
// so draw them once into an offscreen layer and copy it each frame.
const staticLayer = { canvas:null, key:"" };
function drawStaticLayer(){
  const key = [canvas.width, canvas.height, DPR, room.x, room.y, room.w, room.h,
    C.grid, C.border].join("|");   // backgrounds.js also clears key on theme change
  if (!staticLayer.canvas) staticLayer.canvas = document.createElement("canvas");
  const layer = staticLayer.canvas;
  if (staticLayer.key !== key){
    layer.width = canvas.width; layer.height = canvas.height;
    const lctx = layer.getContext("2d");
    lctx.setTransform(DPR,0,0,DPR,0,0);
    drawGrid(lctx); drawRoomBorder(lctx);
    staticLayer.key = key;
  }
  ctx.drawImage(layer, 0, 0, W, H);
}
function traceObstaclePath(o){
  const x=o.x, y=o.y, w=o.w, h=o.h, cx=x+w/2, cy=y+h/2;
  switch (o.shape){
    case "circle":
      ctx.beginPath(); ctx.ellipse(cx,cy,w/2,h/2,0,0,Math.PI*2); ctx.closePath();
      break;
    case "diamond":
      ctx.beginPath(); ctx.moveTo(cx,y); ctx.lineTo(x+w,cy); ctx.lineTo(cx,y+h); ctx.lineTo(x,cy); ctx.closePath();
      break;
    case "triangle":
      ctx.beginPath(); ctx.moveTo(cx,y); ctx.lineTo(x+w,y+h); ctx.lineTo(x,y+h); ctx.closePath();
      break;
    case "hex": {
      const pts = [[0.25,0],[0.75,0],[1,0.5],[0.75,1],[0.25,1],[0,0.5]];
      ctx.beginPath();
      pts.forEach(([px,py],i)=>{ const gx=x+px*w, gy=y+py*h; i===0?ctx.moveTo(gx,gy):ctx.lineTo(gx,gy); });
      ctx.closePath();
      break;
    }
    case "rounded":
    case "pill": {
      const r = Math.min(w,h)*OBSTACLE_CORNER[o.shape];
      ctx.beginPath(); ctx.roundRect(x,y,w,h,r);
      break;
    }
    default: {
      const pts = OBSTACLE_POLYGONS[o.shape];
      ctx.beginPath();
      if (pts) {
        pts.forEach(([px,py],i)=>{ const gx=x+px*w, gy=y+py*h; i===0?ctx.moveTo(gx,gy):ctx.lineTo(gx,gy); });
        ctx.closePath();
      } else ctx.rect(x,y,w,h);
    }
  }
}
function drawObstacles(){
  ctx.save();
  for (const o of obstacles){
    traceObstaclePath(o);
    ctx.fillStyle="rgba(34,74,92,0.95)"; ctx.fill();   // ~2:1 against the floor (was 1.3:1)
    ctx.strokeStyle=C.wall; ctx.shadowColor=C.wall; ctx.shadowBlur=10; ctx.lineWidth=2.5;
    ctx.stroke(); ctx.shadowBlur=0;
  }
  ctx.restore();
}
function drawExit(){
  const active=hasPrize; ctx.save();
  ctx.strokeStyle=C.exit; ctx.globalAlpha=active?1:0.28;
  ctx.shadowColor=C.exit; ctx.shadowBlur=active?16:0; ctx.lineWidth=2;
  ctx.strokeRect(exit.x,exit.y,exit.w,exit.h);
  ctx.fillStyle=C.exit; ctx.globalAlpha=active?0.9:0.35;
  ctx.font="12px ui-monospace, monospace"; ctx.textAlign="center"; ctx.textBaseline="middle";
  const label = active ? ("EXIT " + EXIT_ARROW[exit.wall]) : "EXIT";
  const cx=exit.x+exit.w/2, cy=exit.y+exit.h/2;
  if (exit.wall==="left" || exit.wall==="right"){
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(Math.PI/2); ctx.fillText(label,0,0); ctx.restore();
  } else {
    ctx.fillText(label, cx, cy);
  }
  ctx.restore();
}
function drawDepartureZone(){
  if (!departureZone) return;
  const life=clamp(departureZone.ticks/CFG.EXIT_HANDOFF_TICKS,0,1);
  const pulse=0.55+0.25*Math.sin(performance.now()/110);
  const cx=departureZone.x+departureZone.w/2, cy=departureZone.y+departureZone.h/2;
  ctx.save();
  ctx.globalAlpha=Math.max(0.18,life)*pulse;
  ctx.strokeStyle=C.exit; ctx.shadowColor=C.exit; ctx.shadowBlur=12; ctx.lineWidth=2;
  ctx.setLineDash([8,6]);
  ctx.strokeRect(departureZone.x,departureZone.y,departureZone.w,departureZone.h);
  ctx.setLineDash([]); ctx.shadowBlur=0; ctx.globalAlpha=Math.max(0.3,life);
  ctx.fillStyle=C.exit; ctx.font="11px ui-monospace, monospace";
  ctx.textAlign="center"; ctx.textBaseline="middle";
  if (departureZone.wall==="left" || departureZone.wall==="right"){
    ctx.translate(cx,cy); ctx.rotate(Math.PI/2); ctx.fillText("SAFE \u2014 MOVE",0,0);
  } else ctx.fillText("SAFE \u2014 MOVE",cx,cy);
  ctx.restore();
}
function drawPrize(){
  if (!prize) return;
  const t=performance.now();
  const pulse=1+Math.sin(t/320)*0.08;
  const r=CFG.PRIZE_R*pulse, half=r*0.72;
  ctx.save();
  ctx.globalAlpha=0.42+0.18*Math.sin(t/320);
  ctx.strokeStyle="#fffde7"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(prize.x,prize.y,r*1.75,0,Math.PI*2); ctx.stroke();
  ctx.globalAlpha=1; ctx.translate(prize.x,prize.y); ctx.rotate(Math.PI/4);
  ctx.fillStyle=C.prize; ctx.strokeStyle="#fffde7";
  ctx.shadowColor=C.prize; ctx.shadowBlur=22; ctx.lineWidth=1.5;
  ctx.fillRect(-half,-half,half*2,half*2);
  ctx.shadowBlur=0; ctx.strokeRect(-half,-half,half*2,half*2);
  ctx.restore();
}
// Eye marks identify a ghost even when its cosmetic color matches the exit.
const reducedMotionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
function drawGhostBody(context,x,y,r,color,alpha){
  glow(context,x,y,r,color,reducedMotionPreference.matches ? 1 : alpha);
  const rim = ghostOutline(color);
  if (rim){
    context.save(); context.globalAlpha=0.95; context.strokeStyle=rim; context.lineWidth=Math.max(1.5,r*.22);
    context.beginPath(); context.arc(x,y,r*1.02,0,Math.PI*2); context.stroke(); context.restore();
  }
  context.save(); context.globalAlpha=1; context.fillStyle="#070b10";
  for (const side of [-1,1]) {
    context.beginPath(); context.arc(x+side*r*.30,y-r*.12,Math.max(1.4,r*.18),0,Math.PI*2); context.fill();
  }
  context.restore();
}
function drawGhosts(){
  for (let i=0;i<ghosts.length;i++){
    const g=ghosts[i], pos=ghostPos(g); if (!pos) continue;
    ctx.strokeStyle=selectedGhostSkin; ctx.globalAlpha=0.10; ctx.lineWidth=4;
    const p=g.path; ctx.beginPath(); ctx.moveTo(p[0].x,p[0].y);
    for (let k=1;k<p.length;k+=3) ctx.lineTo(p[k].x,p[k].y);
    ctx.stroke(); ctx.globalAlpha=1;
    const flick=(i===0 && sweep)?(0.45+0.4*Math.sin(performance.now()/40)):1;
    const dimmed = mode===STATE.DYING && killerGhost>=0 && i!==killerGhost;
    if (dimmed) ctx.globalAlpha=0.3;
    drawGhostBody(ctx,pos.x,pos.y,CFG.GHOST_R,selectedGhostSkin,dimmed?0.3:flick);
    ctx.globalAlpha=1;
    const teaching = toast && toast.teach && i===ghosts.length-1 && mode===STATE.PLAYING;
    if (teaching || (mode===STATE.DYING && i===killerGhost)) drawGhostCallout(g, pos);
  }
}
/* A white ring calls out one ghost: the brand-new one while it is being taught,
   and the one that caught you during the death animation, with its route traced
   so you can see where it was heading. */
function drawGhostCallout(g, pos){
  const t = performance.now()/1000;
  ctx.save();
  if (mode===STATE.DYING){
    const p=g.path; ctx.strokeStyle=selectedGhostSkin; ctx.globalAlpha=0.55; ctx.lineWidth=2.5; ctx.setLineDash([6,6]);
    ctx.beginPath(); ctx.moveTo(p[0].x,p[0].y); for (let k=1;k<p.length;k+=2) ctx.lineTo(p[k].x,p[k].y); ctx.stroke();
    ctx.setLineDash([]);
  }
  const r = CFG.GHOST_R*2.1 + (reducedMotionPreference.matches ? 0 : Math.sin(t*8)*2);
  ctx.globalAlpha=0.95; ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.shadowColor="#fff"; ctx.shadowBlur=10;
  ctx.beginPath(); ctx.arc(pos.x,pos.y,r,0,Math.PI*2); ctx.stroke();
  ctx.restore();
}
function drawSweep(){
  if (!sweep) return; const x=room.x+sweep.t*room.w; ctx.save();
  ctx.strokeStyle=C.sweep; ctx.shadowColor=C.sweep; ctx.shadowBlur=20;
  ctx.lineWidth=3; ctx.globalAlpha=0.9; ctx.beginPath();
  ctx.moveTo(x,room.y); ctx.lineTo(x,room.y+room.h); ctx.stroke(); ctx.restore();
}
function trailColorAt(i, n){
  if (selectedTrail!=="rainbow") return playerColor;
  const hue = ((i/n)*300 + performance.now()/12) % 360;
  return "hsl(" + hue + ",90%,60%)";
}
function drawTrail(){
  const span = selectedTrail==="long" ? 30 : 16;
  const n=currentPath.length, start=Math.max(0,n-span);
  for (let i=start;i<n;i++){
    const t=(i-start)/span; ctx.globalAlpha=0.16*t; ctx.fillStyle=trailColorAt(i,n);
    ctx.beginPath(); ctx.arc(currentPath[i].x,currentPath[i].y,CFG.PLAYER_R*(0.35+0.5*t),0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
  if (selectedTrail==="sparkle" && n>0 && Math.random()<0.5){
    const p = currentPath[n-1];
    const a=Math.random()*Math.PI*2, r=6+Math.random()*10;
    ctx.globalAlpha=0.7; ctx.fillStyle="#fff";
    ctx.beginPath(); ctx.arc(p.x+Math.cos(a)*r, p.y+Math.sin(a)*r, 1+Math.random()*1.5, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
  }
}
function drawPlayer(){
  const blink=(grace>0 && Math.floor(frame/4)%2===0)?0.45:1;
  drawSkin(ctx, player.x, player.y, CFG.PLAYER_R, playerColor, playerStyle, blink, performance.now()/1000);
  if (hasPrize){
    ctx.globalAlpha=blink; ctx.fillStyle=C.prize;
    ctx.beginPath(); ctx.arc(player.x,player.y,CFG.PLAYER_R*0.42,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
  }
}
function drawParticles(){
  for (const p of particles){
    ctx.globalAlpha=Math.max(0,p.life); ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
}
function drawPops(){
  ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.font="600 15px ui-monospace, monospace";
  for (const q of pops){
    // Keep the whole label inside the arena, e.g. "ROUND 3 CLEAR" at a side exit.
    const half = ctx.measureText(q.text).width/2 + 6;
    const x = clamp(q.x, room.x+half, room.x+room.w-half);
    const y = clamp(q.y, room.y+14, room.y+room.h-14);
    ctx.globalAlpha=Math.max(0,q.life); ctx.fillStyle=q.color; ctx.fillText(q.text,x,y);
  }
  ctx.globalAlpha=1;
}
/* Canvas text never wraps by itself, and a centred line wider than the arena
   clips at both ends on phones. Split on "\n", then wrap each line to maxW. */
function wrapCanvasText(target, text, maxW){
  const lines = [];
  for (const para of String(text).split("\n")){
    let line = "";
    for (const word of para.split(" ")){
      const next = line ? line + " " + word : word;
      if (line && target.measureText(next).width > maxW){ lines.push(line); line = word; }
      else line = next;
    }
    lines.push(line);
  }
  return lines;
}
// A dark plate behind teaching text keeps it readable over any background or ghost.
function drawTextPlate(target, lines, cx, cy, lineH, maxW, border){
  const w = Math.min(maxW, Math.max(...lines.map(l => target.measureText(l).width))) + 24;
  const h = lines.length*lineH + 14;
  const base = target.globalAlpha;
  target.save(); target.shadowBlur = 0;
  target.beginPath(); target.roundRect(cx-w/2, cy-h/2, w, h, 8);
  target.globalAlpha = base*0.86; target.fillStyle = C.bg || "#070b10"; target.fill();
  target.globalAlpha = base*0.6; target.strokeStyle = border; target.lineWidth = 1; target.stroke();
  target.restore();
}
function drawHint(){
  if (hintSeen || round!==1) return;
  const a=0.55+0.4*Math.sin(performance.now()/300);
  const target = hasPrize ? { x:exit.x+exit.w/2, y:exit.y+exit.h/2 } : prize;
  if (target){
    ctx.save(); ctx.globalAlpha=a*0.35; ctx.strokeStyle=hasPrize?C.exit:C.prize;
    ctx.setLineDash([6,8]); ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(player.x,player.y); ctx.lineTo(target.x,target.y); ctx.stroke(); ctx.restore();
  }
  // Pinned to the bottom of the arena so it never follows the dot off-screen.
  ctx.save(); ctx.font="600 14px ui-monospace, monospace"; ctx.textAlign="center"; ctx.textBaseline="middle";
  const maxW = room.w - 32, lineH = 18;
  const lines = wrapCanvasText(ctx, hasPrize ? "NOW REACH THE GREEN EXIT" : "TAP OR DRAG TO THE YELLOW DIAMOND", maxW);
  const cx = room.x+room.w/2, cy = room.y+room.h - 16 - lines.length*lineH/2;
  drawTextPlate(ctx, lines, cx, cy, lineH, maxW, hasPrize ? C.exit : C.prize);
  ctx.globalAlpha=Math.max(0.75,a); ctx.fillStyle=hasPrize?C.exit:C.ink;
  lines.forEach((l,i) => ctx.fillText(l, cx, cy - (lines.length-1)*lineH/2 + i*lineH));
  ctx.restore();
}
function drawShockwaves(){
  for (const s of shockwaves){
    const r = 6 + s.t*90;
    ctx.save(); ctx.globalAlpha = Math.max(0,1-s.t); ctx.strokeStyle = playerColor;
    ctx.shadowColor = playerColor; ctx.shadowBlur = 14; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI*2); ctx.stroke(); ctx.restore();
  }
}
function drawToast(){
  if (!toast || mode!==STATE.PLAYING || paused) return;   // never show behind menus
  const life = toast.life || 2.6;
  const a = toast.t<0.3 ? toast.t/0.3 : (toast.t>life-0.6 ? Math.max(0,(life-toast.t)/0.6) : 1);
  ctx.save(); ctx.globalAlpha=a; ctx.font="600 17px ui-monospace, monospace";
  ctx.textAlign="center"; ctx.textBaseline="middle";
  const maxW = room.w - 48, lineH = 23;
  const lines = wrapCanvasText(ctx, toast.text, maxW);
  // Centered in the arena with no box behind it, so nothing in play is hidden.
  // A thin dark outline keeps the letters readable over ghosts and obstacles.
  const cx = room.x+room.w/2, cy = room.y + room.h/2;
  const accent = toast.teach ? "#fff" : (toast.priority >= 3 ? C.exit : C.sweep);
  const y0 = cy - (lines.length-1)*lineH/2;
  ctx.lineJoin = "round"; ctx.lineWidth = 4; ctx.strokeStyle = C.bg || "#070b10";
  lines.forEach((l,i) => ctx.strokeText(l, cx, y0 + i*lineH));
  ctx.fillStyle = accent;
  lines.forEach((l,i) => ctx.fillText(l, cx, cy - (lines.length-1)*lineH/2 + i*lineH));
  ctx.restore();
}
function render(){
  ctx.clearRect(0,0,W,H);
  ctx.save();
  if (shake>0.3 && !reducedMotionPreference.matches) ctx.translate((Math.random()-0.5)*shake, (Math.random()-0.5)*shake);
  drawStaticLayer(); drawObstacles(); drawDepartureZone(); drawExit();
  drawGhosts(); drawPrize(); drawSweep();
  if (mode===STATE.PLAYING){ drawTrail(); drawPlayer(); drawHint(); }
  drawParticles(); drawShockwaves(); drawPops(); drawToast();
  ctx.restore();
}
function setPreviewItem(cat, id){
  if (cat==="colors") previewColor = id;
  else if (cat==="trail") previewTrail = id;
  else if (cat==="ghost") previewGhostColor = id;
  else if (cat==="death"){ previewDeath = id; previewDeathT = 999; }   // force an immediate replay
}
function drawPreviewGrid(pctx,w,h){
  pctx.strokeStyle=C.grid; pctx.lineWidth=1; const gap=20; pctx.beginPath();
  for (let x=0;x<=w;x+=gap){ pctx.moveTo(x,0); pctx.lineTo(x,h); }
  for (let y=0;y<=h;y+=gap){ pctx.moveTo(0,y); pctx.lineTo(w,y); }
  pctx.stroke();
}
function drawShopPreview(){
  const pctx = el.shopPreview.getContext("2d");
  const w = el.shopPreview.width, h = el.shopPreview.height, cx = w/2, cy = h/2;
  pctx.clearRect(0,0,w,h);
  drawPreviewGrid(pctx,w,h);
  if (previewTab==="colors"){
    const pulse = 1+Math.sin(performance.now()/200)*0.12;
    drawSkin(pctx, cx, cy, 14*pulse, previewColor, getSkinStyle(previewColor), 1, performance.now()/1000);
  } else if (previewTab==="trail"){
    previewPhase += 0.05;
    const rx=90, ry=26;
    const px = cx + Math.cos(previewPhase)*rx, py = cy + Math.sin(previewPhase)*ry;
    previewTrailPath.push({ x:px, y:py });
    if (previewTrailPath.length>40) previewTrailPath.shift();
    const span = previewTrail==="long" ? 30 : 16;
    const n = previewTrailPath.length, start = Math.max(0,n-span);
    for (let i=start;i<n;i++){
      const t=(i-start)/span;
      let color = playerColor;
      if (previewTrail==="rainbow"){ const hue=((i/n)*300+performance.now()/12)%360; color="hsl("+hue+",90%,60%)"; }
      pctx.globalAlpha=0.2*t; pctx.fillStyle=color;
      pctx.beginPath(); pctx.arc(previewTrailPath[i].x,previewTrailPath[i].y,8*(0.35+0.5*t),0,Math.PI*2); pctx.fill();
    }
    pctx.globalAlpha=1;
    if (previewTrail==="sparkle" && Math.random()<0.5){
      const a=Math.random()*Math.PI*2, r2=6+Math.random()*8;
      pctx.globalAlpha=0.7; pctx.fillStyle="#fff";
      pctx.beginPath(); pctx.arc(px+Math.cos(a)*r2, py+Math.sin(a)*r2, 1+Math.random()*1.4, 0, Math.PI*2); pctx.fill();
      pctx.globalAlpha=1;
    }
    glow(pctx, px, py, 8, playerColor, 1);
  } else if (previewTab==="ghost"){
    const flick = 0.55+0.4*Math.sin(performance.now()/180);
    drawGhostBody(pctx, cx, cy, 12, previewGhostColor, flick);
  } else if (previewTab==="death"){
    previewDeathT += 1/60;
    if (previewDeathT > 1.3){ previewDeathT=0; runDeathFX(previewDeath, previewParticles, previewShockwaves, cx, cy, selectedGhostSkin); }
    for (let i=previewParticles.length-1;i>=0;i--){
      const p=previewParticles[i];
      p.x+=p.vx; p.y+=p.vy; p.vx*=0.93; p.vy*=0.93; p.life-=(1/60)*1.5;
      if (p.life<=0){ previewParticles.splice(i,1); continue; }
      pctx.globalAlpha=Math.max(0,p.life); pctx.fillStyle=p.color;
      pctx.beginPath(); pctx.arc(p.x,p.y,p.r,0,Math.PI*2); pctx.fill();
    }
    pctx.globalAlpha=1;
    for (let i=previewShockwaves.length-1;i>=0;i--){
      const s=previewShockwaves[i]; s.t+=(1/60)/0.6;
      if (s.t>=1){ previewShockwaves.splice(i,1); continue; }
      const r = 4+s.t*32;
      pctx.save(); pctx.globalAlpha=Math.max(0,1-s.t); pctx.strokeStyle=playerColor;
      pctx.lineWidth=2; pctx.beginPath(); pctx.arc(s.x,s.y,r,0,Math.PI*2); pctx.stroke(); pctx.restore();
    }
  }
}
// The HUD refreshes every frame; only touch the DOM when a value changes so the
// web view doesn't redo text layout 60 times a second.
function setHudText(node, value){ value = String(value); if (node.textContent !== value) node.textContent = value; }
const hudColors = new WeakMap();   // style.color reads back normalized, so remember what we set
function setHudColor(node, value){ if (hudColors.get(node) !== value){ hudColors.set(node, value); node.style.color = value; } }
function updateHUD(){
  setHudText(el.round, round); setHudText(el.coins, formatCoinsCompact(coins));
  const completedRounds = round - 1;
  const movesLeft = CFG.GC_MOVES - (completedRounds % CFG.GC_MOVES);
  const armed = ghosts.length > 0;
  setHudText(el.gc, sweep ? "SWEEP" : movesLeft);
  setHudColor(el.gc, sweep ? C.sweep : (armed ? (movesLeft<=2 ? C.sweep : "") : C.dim));
}
"use strict";
