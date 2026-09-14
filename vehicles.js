/* Echo Steps — Vehicle skins + themed maps.
 * Loaded before the main game script (see index.html): defines the globals
 * VEHICLES, VEHICLE_MAPS, and drawVehicle(), which the main script's shop
 * and renderer consume. Kept in its own file since it's pure content/data
 * plus one drawing function, independent of game state.
 */
"use strict";

/* Each vehicle pairs a color with a themed map (background/grid/obstacles)
   that's applied automatically when the vehicle is selected. */
const VEHICLES = [
  { id:"car",        label:"Car",        color:"#29e0ff", cost:0,  mapId:"streets" },
  { id:"bicycle",    label:"Bicycle",    color:"#39ff9e", cost:20, mapId:"park"    },
  { id:"motorcycle", label:"Motorcycle", color:"#ff5ca8", cost:35, mapId:"highway" },
  { id:"truck",      label:"Truck",      color:"#ff8a2b", cost:50, mapId:"yard"    },
  { id:"tanker",     label:"Tanker",     color:"#b06bff", cost:70, mapId:"harbor"  },
];

/* bg/grid re-theme the whole room (via CSS var overrides); obstacleShape and
   obstacleColor re-theme the walls to match. */
const VEHICLE_MAPS = {
  streets: { label:"City Streets",  bg:"#0b0f14", grid:"#1c2733", obstacleShape:"cone",    obstacleColor:"#ff8a2b" },
  park:    { label:"Park Trail",    bg:"#08150f", grid:"#123322", obstacleShape:"tree",    obstacleColor:"#39ff9e" },
  highway: { label:"Night Highway", bg:"#0a0a12", grid:"#20202f", obstacleShape:"barrier", obstacleColor:"#ffd23f" },
  yard:    { label:"Cargo Yard",    bg:"#100c08", grid:"#332417", obstacleShape:"crate",   obstacleColor:"#c9862f" },
  harbor:  { label:"Harbor Docks",  bg:"#061019", grid:"#12283a", obstacleShape:"barrel",  obstacleColor:"#39c2ff" },
};

/* Draws a simple top-down vehicle silhouette centered at (x,y), scaled to r.
   Shared by the live game and the shop preview panel. */
function drawVehicle(ctx, x, y, r, color, id, alpha, tSec) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;

  switch (id) {
    case "bicycle": {
      const wr = r * 0.62;
      ctx.lineWidth = Math.max(1.5, r * 0.14);
      ctx.beginPath(); ctx.arc(-r*0.55, 0, wr, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc( r*0.55, 0, wr, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r*0.55, 0); ctx.lineTo(0, -r*0.5); ctx.lineTo(r*0.55, 0);
      ctx.moveTo(-r*0.15, -r*0.5); ctx.lineTo(r*0.2, -r*0.5);
      ctx.stroke();
      break;
    }
    case "motorcycle": {
      const wr = r * 0.4;
      ctx.lineWidth = Math.max(1.5, r * 0.18);
      ctx.beginPath(); ctx.arc(-r*0.6, r*0.12, wr, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc( r*0.6, r*0.12, wr, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(-r*0.55, -r*0.38, r*1.1, r*0.42, r*0.15); ctx.fill();
      break;
    }
    case "truck": {
      ctx.beginPath(); ctx.roundRect(-r*0.95, -r*0.55, r*1.15, r*1.1, r*0.12); ctx.fill();   // cargo box
      ctx.beginPath(); ctx.roundRect(r*0.22, -r*0.4, r*0.68, r*0.8, r*0.12); ctx.fill();      // cab
      ctx.fillStyle = "#0b0f14";
      ctx.beginPath(); ctx.arc(-r*0.5, r*0.6, r*0.22, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc( r*0.55, r*0.6, r*0.22, 0, Math.PI*2); ctx.fill();
      break;
    }
    case "tanker": {
      ctx.beginPath(); ctx.ellipse(0, 0, r*1.05, r*0.6, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = Math.max(1, r*0.08);
      ctx.beginPath(); ctx.moveTo(-r*0.35, -r*0.55); ctx.lineTo(-r*0.35, r*0.55); ctx.stroke();
      ctx.beginPath(); ctx.moveTo( r*0.35, -r*0.55); ctx.lineTo( r*0.35, r*0.55); ctx.stroke();
      break;
    }
    default: {   // car
      ctx.beginPath(); ctx.roundRect(-r*0.95, -r*0.55, r*1.9, r*1.1, r*0.35); ctx.fill();
      ctx.fillStyle = "#0b0f14";
      ctx.beginPath(); ctx.arc(-r*0.55, r*0.6, r*0.22, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc( r*0.55, r*0.6, r*0.22, 0, Math.PI*2); ctx.fill();
    }
  }
  ctx.restore();
}
