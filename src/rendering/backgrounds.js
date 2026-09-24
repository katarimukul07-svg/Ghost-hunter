/* Echo Steps selectable environment backgrounds. */
(() => {
  "use strict";

  const BACKGROUND_IDS = BACKGROUNDS.map(theme => theme.id);
  const savedBackground = ls("echoSteps.background");
  let selectedBackground = BACKGROUND_IDS.includes(savedBackground) ? savedBackground : "classic";
  let previewBackground = selectedBackground;

  function fillRect(context, bounds, color) {
    context.fillStyle = color;
    context.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
  }

  function drawCircuit(context, bounds) {
    const { x, y, w, h } = bounds;
    const gradient = context.createRadialGradient(x+w*0.72,y+h*0.22,0,x+w*0.72,y+h*0.22,w*0.65);
    gradient.addColorStop(0,"#0b252a");
    gradient.addColorStop(0.45,"#07161b");
    gradient.addColorStop(1,"#03080b");
    fillRect(context,bounds,gradient);

    context.save();
    context.strokeStyle="rgba(18,116,124,0.34)";
    context.fillStyle="rgba(32,164,169,0.38)";
    context.lineWidth=Math.max(1,w/700);
    const paths = [
      [[.05,.18],[.28,.18],[.28,.42],[.52,.42]],
      [[.12,.78],[.34,.78],[.34,.61],[.72,.61],[.72,.34],[.91,.34]],
      [[.48,.08],[.48,.28],[.82,.28],[.82,.72]],
      [[.08,.52],[.20,.52],[.20,.66],[.54,.66],[.54,.88]],
    ];
    for (const path of paths) {
      context.beginPath();
      path.forEach(([px,py],index) => index
        ? context.lineTo(x+px*w,y+py*h)
        : context.moveTo(x+px*w,y+py*h));
      context.stroke();
      for (const [px,py] of path) {
        context.beginPath();
        context.arc(x+px*w,y+py*h,Math.max(2,w/300),0,Math.PI*2);
        context.fill();
      }
    }
    context.restore();
  }

  function drawOrbit(context, bounds) {
    const { x, y, w, h } = bounds;
    const gradient = context.createLinearGradient(x,y,x+w,y+h);
    gradient.addColorStop(0,"#030611");
    gradient.addColorStop(0.55,"#07101d");
    gradient.addColorStop(1,"#02050b");
    fillRect(context,bounds,gradient);

    context.save();
    const stars = [
      [.08,.17,1.0],[.15,.46,.7],[.24,.12,.8],[.31,.72,1.0],[.39,.26,.6],
      [.48,.83,.8],[.57,.13,1.0],[.65,.55,.7],[.73,.22,.9],[.82,.69,.8],
      [.90,.16,.7],[.94,.47,1.0],[.54,.43,.5],[.20,.86,.6],[.77,.88,.5],
    ];
    context.fillStyle="rgba(216,241,255,0.62)";
    for (const [px,py,size] of stars) {
      context.beginPath();
      context.arc(x+px*w,y+py*h,Math.max(.7,size*w/700),0,Math.PI*2);
      context.fill();
    }

    const planet = context.createRadialGradient(x+w*.08,y+h*1.02,0,x+w*.08,y+h*1.02,w*.42);
    planet.addColorStop(0,"rgba(42,103,145,0.72)");
    planet.addColorStop(.48,"rgba(20,59,91,0.54)");
    planet.addColorStop(.52,"rgba(28,84,119,0.20)");
    planet.addColorStop(1,"rgba(0,0,0,0)");
    context.fillStyle=planet;
    context.fillRect(x,y,w,h);

    context.strokeStyle="rgba(116,172,213,0.18)";
    context.lineWidth=Math.max(1,w/650);
    context.beginPath();
    context.ellipse(x+w*.58,y+h*.48,w*.31,h*.43,-.28,0,Math.PI*2);
    context.stroke();
    context.beginPath();
    context.ellipse(x+w*.58,y+h*.48,w*.40,h*.25,-.28,0,Math.PI*2);
    context.stroke();
    context.restore();
  }

  function drawAbyss(context, bounds) {
    const { x, y, w, h } = bounds;
    const gradient = context.createLinearGradient(x,y,x,y+h);
    gradient.addColorStop(0,"#082131");
    gradient.addColorStop(.42,"#041521");
    gradient.addColorStop(1,"#02070c");
    fillRect(context,bounds,gradient);

    context.save();
    const cx=x+w*.52, cy=y+h*.45;
    context.strokeStyle="rgba(58,164,190,0.13)";
    context.lineWidth=Math.max(1,w/680);
    for (let radius=Math.min(w,h)*.14; radius<Math.max(w,h)*.62; radius+=Math.min(w,h)*.14) {
      context.beginPath();
      context.arc(cx,cy,radius,0,Math.PI*2);
      context.stroke();
    }

    context.strokeStyle="rgba(74,181,206,0.18)";
    const bubbles = [[.09,.68,.012],[.16,.28,.008],[.31,.82,.006],[.71,.20,.01],[.84,.72,.015],[.92,.39,.007]];
    for (const [px,py,size] of bubbles) {
      context.beginPath();
      context.arc(x+px*w,y+py*h,Math.max(2,w*size),0,Math.PI*2);
      context.stroke();
    }

    const glow = context.createRadialGradient(cx,y,0,cx,y,w*.55);
    glow.addColorStop(0,"rgba(30,139,169,0.16)");
    glow.addColorStop(1,"rgba(0,0,0,0)");
    context.fillStyle=glow;
    context.fillRect(x,y,w,h);
    context.restore();
  }

  function drawBackground(context, bounds, themeId) {
    context.save();
    context.beginPath();
    context.rect(bounds.x,bounds.y,bounds.w,bounds.h);
    context.clip();
    if (themeId === "orbit") drawOrbit(context,bounds);
    else if (themeId === "abyss") drawAbyss(context,bounds);
    else drawCircuit(context,bounds);
    context.restore();
  }

  const drawGridBase = drawGrid;
  drawGrid = function drawThemedGrid() {
    if (selectedBackground === "classic") {
      drawGridBase();
      return;
    }
    drawBackground(ctx,room,selectedBackground);
    ctx.save();
    ctx.globalAlpha=.48;
    drawGridBase();
    ctx.restore();
  };

  const drawPreviewGridBase = drawPreviewGrid;
  drawPreviewGrid = function drawThemedPreviewGrid(previewContext,w,h) {
    const theme = previewTab === "background" ? previewBackground : selectedBackground;
    if (theme === "classic") {
      drawPreviewGridBase(previewContext,w,h);
      return;
    }
    drawBackground(previewContext,{x:0,y:0,w,h},theme);
    previewContext.save();
    previewContext.globalAlpha=.46;
    drawPreviewGridBase(previewContext,w,h);
    previewContext.restore();
  };

  function drawBackgroundPreviewObjects() {
    if (previewTab !== "background") return;
    const previewContext=el.shopPreview.getContext("2d");
    const w=el.shopPreview.width,h=el.shopPreview.height;
    previewContext.save();

    previewContext.strokeStyle=C.exit;
    previewContext.fillStyle="rgba(3,16,12,.72)";
    previewContext.lineWidth=2;
    previewContext.fillRect(w*.43,0,w*.18,h*.22);
    previewContext.strokeRect(w*.43,0,w*.18,h*.22);
    previewContext.fillStyle=C.exit;
    previewContext.font="700 9px ui-monospace, monospace";
    previewContext.textAlign="center";
    previewContext.fillText("EXIT",w*.52,h*.14);

    drawSkin(previewContext,w*.22,h*.72,9,playerColor,playerStyle,1,performance.now()/1000);
    glow(previewContext,w*.74,h*.34,7,selectedGhostSkin,1);

    previewContext.translate(w*.78,h*.76);
    previewContext.rotate(Math.PI/4);
    previewContext.fillStyle=C.prize;
    previewContext.shadowColor=C.prize;
    previewContext.shadowBlur=12;
    previewContext.fillRect(-6,-6,12,12);
    previewContext.restore();
  }

  const drawShopPreviewBase = drawShopPreview;
  drawShopPreview = function drawShopPreviewWithBackgrounds() {
    drawShopPreviewBase();
    drawBackgroundPreviewObjects();
  };

  const tab=document.createElement("button");
  tab.className="tab";
  tab.dataset.cat="background";
  tab.textContent="BACKGROUND";
  el.shopTabs.appendChild(tab);

  const backgroundContainer=document.createElement("div");
  backgroundContainer.id="shopBackground";
  backgroundContainer.className="swatches hidden";
  el.shopHint.before(backgroundContainer);

  function selectBackground(id) {
    if (!BACKGROUND_IDS.includes(id)) return;
    selectedBackground=id;
    previewBackground=id;
    ss("echoSteps.background",id);
    haptic("light");
  }

  const buildShopAllBase=buildShopAll;
  buildShopAll=function buildShopWithBackgrounds() {
    buildShopAllBase();
    renderShopCategory(
      backgroundContainer,
      BACKGROUNDS,
      BACKGROUND_IDS,
      "echoSteps.backgroundOwned",
      () => selectedBackground,
      selectBackground,
      false,
      "background",
    );
  };

  const setPreviewItemBase=setPreviewItem;
  setPreviewItem=function setPreviewItemWithBackground(cat,id) {
    setPreviewItemBase(cat,id);
    if (cat==="background" && BACKGROUND_IDS.includes(id)) previewBackground=id;
  };

  const setShopTabBase=setShopTab;
  setShopTab=function setShopTabWithBackground(cat) {
    setShopTabBase(cat);
    backgroundContainer.classList.toggle("hidden",cat!=="background");
    if (cat==="background") {
      previewBackground=selectedBackground;
      el.shopHint.textContent="Choose the environment behind the arena. All launch backgrounds are free.";
    }
  };

  Object.defineProperty(window,"__echoStepsBackgroundTest",{
    value:Object.freeze({
      snapshot:()=>({
        selected:selectedBackground,
        preview:previewBackground,
        available:BACKGROUNDS.map(theme=>theme.id),
      }),
      select:selectBackground,
    }),
  });

  console.info("Echo Steps backgrounds loaded: Classic Grid, Circuit Foundry, Orbital Station, and Abyssal Network.");
})();
