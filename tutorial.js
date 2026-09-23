/* Echo Steps first-run and replayable tutorial. */
(() => {
  "use strict";

  const STORAGE_KEY = "echoSteps.tutorial.v1";
  const steps = [
    {
      kicker:"STEP 1 OF 7",
      title:"YOU ARE THE BLUE NODE",
      body:"Touch and drag anywhere on the arena. Your NODE follows your finger with a small offset so you can still see it.",
      visual:"move",
      accent:"#29e0ff",
      note:"Keep moving. A stationary packet is an easy target.",
    },
    {
      kicker:"STEP 2 OF 7",
      title:"COLLECT THE YELLOW TARGET",
      body:"Guide the blue NODE into the yellow diamond. Collecting it unlocks the exit for that round.",
      visual:"target",
      accent:"#fff15c",
      note:"The yellow diamond is the objective—not an enemy.",
    },
    {
      kicker:"STEP 3 OF 7",
      title:"ESCAPE THROUGH GREEN",
      body:"After securing the target, reach the glowing green gate to clear the round. The exit can relocate every five rounds.",
      visual:"exit",
      accent:"#39ff9e",
      note:"The active exit and its relocation handoff are protected zones.",
    },
    {
      kicker:"STEP 4 OF 7",
      title:"YOUR PATH BECOMES A GHOST",
      body:"Every completed round creates a red echo that repeats the route you just travelled. Never touch a red ghost.",
      visual:"ghost",
      accent:"#ff3554",
      note:"Plan clean paths now—you will have to survive them later.",
    },
    {
      kicker:"STEP 5 OF 7",
      title:"WATCH THE GC COUNTDOWN",
      body:"GC IN shows when the Garbage Collector will sweep. At every tenth completed round, it clears some of the oldest ghosts.",
      visual:"gc",
      accent:"#c66bff",
      note:"Use the sweep timing to reclaim dangerous parts of the arena.",
    },
    {
      kicker:"STEP 6 OF 7",
      title:"CHASE BONUSES—IF IT IS SAFE",
      body:"From round 2, short-lived bonuses can appear. Green blocks one hit, purple slows ghosts, and white awards three coins.",
      visual:"bonus",
      accent:"#eaf2ff",
      note:"Sometimes two bonuses appear far apart. You may not be able to take both.",
    },
    {
      kicker:"STEP 7 OF 7",
      title:"SURVIVE YOUR OWN HISTORY",
      body:"Collect the target, reach the exit, avoid echoes, and use bonuses or GC sweeps when the grid becomes crowded.",
      visual:"ready",
      accent:"#29e0ff",
      note:"You are ready. Each run teaches you a safer route.",
    },
  ];

  let stepIndex = 0;
  let firstRun = false;
  let lastFocus = null;

  function readComplete() {
    try { return localStorage.getItem(STORAGE_KEY) === "complete"; }
    catch (error) { return false; }
  }

  function rememberComplete() {
    try { localStorage.setItem(STORAGE_KEY, "complete"); }
    catch (error) {}
  }

  function visualMarkup(kind) {
    const node = '<span class="tutorial-node" aria-hidden="true"></span>';
    const target = '<span class="tutorial-target" aria-hidden="true"></span>';
    const exit = '<span class="tutorial-exit" aria-hidden="true">EXIT</span>';
    const ghost = '<span class="tutorial-ghost" aria-hidden="true"></span>';
    if (kind === "move") return node + '<span class="tutorial-route route-blue"></span><span class="tutorial-finger" aria-hidden="true">↗</span>';
    if (kind === "target") return node + '<span class="tutorial-route route-target"></span>' + target;
    if (kind === "exit") return target + node + '<span class="tutorial-route route-exit"></span>' + exit;
    if (kind === "ghost") return node + ghost + '<span class="tutorial-route route-ghost"></span>';
    if (kind === "gc") return '<span class="tutorial-gc-line" aria-hidden="true"></span>' + ghost + '<span class="tutorial-gc-label">GC SWEEP</span>';
    if (kind === "bonus") return node + '<span class="tutorial-bonus bonus-shield">1-HIT</span><span class="tutorial-bonus bonus-slow">SLOW</span><span class="tutorial-bonus bonus-cache">+3</span>';
    return node + target + exit + ghost;
  }

  function installStyles() {
    const style = document.createElement("style");
    style.id = "tutorialStyles";
    style.textContent = [
      "#tutorialScreen{z-index:20;background:rgba(4,8,12,.96);}",
      ".tutorial-shell{width:min(92vw,520px);display:flex;flex-direction:column;align-items:center;gap:14px;}",
      ".tutorial-kicker{font-size:10px;letter-spacing:2px;color:var(--dim);}",
      "#tutorialTitle{font-size:clamp(20px,5vw,30px);}",
      ".tutorial-copy{max-width:46ch;color:var(--ink);font-size:14px;line-height:1.65;min-height:70px;}",
      ".tutorial-note{max-width:45ch;color:var(--dim);font-size:12px;line-height:1.5;min-height:38px;}",
      ".tutorial-board{position:relative;width:min(86vw,430px);height:190px;border:1px solid rgba(41,224,255,.35);border-radius:12px;overflow:hidden;background-color:#070b10;background-image:linear-gradient(rgba(14,34,48,.7) 1px,transparent 1px),linear-gradient(90deg,rgba(14,34,48,.7) 1px,transparent 1px);background-size:28px 28px;box-shadow:inset 0 0 28px rgba(41,224,255,.08);}",
      ".tutorial-node,.tutorial-ghost{position:absolute;width:24px;height:24px;border-radius:50%;top:82px;left:54px;}",
      ".tutorial-node{background:#29e0ff;box-shadow:0 0 18px #29e0ff;animation:tutorial-node 2.1s ease-in-out infinite;}",
      ".tutorial-ghost{left:310px;top:102px;width:20px;height:20px;background:#ff3554;box-shadow:0 0 16px #ff3554;animation:tutorial-ghost 1.1s ease-in-out infinite;}",
      ".tutorial-target{position:absolute;width:22px;height:22px;left:320px;top:50px;background:#fff15c;box-shadow:0 0 16px #fff15c;transform:rotate(45deg);}",
      ".tutorial-exit{position:absolute;right:-1px;top:64px;width:74px;height:58px;border:2px solid #39ff9e;color:#39ff9e;display:grid;place-items:center;font-size:10px;letter-spacing:1px;box-shadow:0 0 18px rgba(57,255,158,.35);}",
      ".tutorial-route{position:absolute;height:2px;left:76px;top:94px;transform-origin:left center;border-top:2px dashed currentColor;opacity:.65;}",
      ".route-blue{width:240px;color:#29e0ff;transform:rotate(-8deg);}.route-target{width:248px;color:#fff15c;transform:rotate(-10deg);}.route-exit{width:285px;color:#39ff9e;transform:rotate(1deg);}.route-ghost{width:235px;color:#ff3554;transform:rotate(5deg);}",
      ".tutorial-finger{position:absolute;left:285px;top:48px;color:#fff;font-size:32px;animation:tutorial-finger 2.1s ease-in-out infinite;}",
      ".tutorial-gc-line{position:absolute;top:0;bottom:0;width:5px;left:20px;background:#c66bff;box-shadow:0 0 18px #c66bff;animation:tutorial-sweep 2.4s linear infinite;}",
      ".tutorial-gc-label{position:absolute;left:50%;top:22px;transform:translateX(-50%);color:#c66bff;font-size:12px;letter-spacing:2px;}",
      ".tutorial-bonus{position:absolute;display:grid;place-items:center;width:54px;height:54px;top:68px;font-size:9px;font-weight:700;}",
      ".bonus-shield{left:62px;color:#8dff6a;border:2px solid #8dff6a;clip-path:polygon(25% 7%,75% 7%,100% 50%,75% 93%,25% 93%,0 50%);}",
      ".bonus-slow{left:188px;color:#c66bff;border-bottom:48px solid rgba(198,107,255,.18);border-left:28px solid transparent;border-right:28px solid transparent;width:0;height:0;line-height:54px;}",
      ".bonus-cache{right:58px;color:#eaf2ff;border:2px solid #eaf2ff;transform:rotate(45deg);}.bonus-cache::first-line{transform:rotate(-45deg);}",
      ".tutorial-dots{display:flex;gap:8px}.tutorial-dot{width:8px;height:8px;border-radius:50%;background:var(--dim);opacity:.45}.tutorial-dot.active{background:var(--player);opacity:1;box-shadow:0 0 8px var(--player);}",
      ".tutorial-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}.tutorial-actions button{min-width:104px}.tutorial-skip{background:transparent;color:var(--dim);border:1px solid var(--dim);box-shadow:none;}",
      "#tutorialBack:disabled{opacity:.3;cursor:default}.tutorial-menu-btn{background:rgba(255,255,255,.05);color:var(--ink);border:1px solid var(--dim);box-shadow:none;}",
      "@keyframes tutorial-node{0%,100%{transform:translate(0,0)}50%{transform:translate(230px,-25px)}}",
      "@keyframes tutorial-finger{0%,100%{transform:translate(-200px,50px)}50%{transform:translate(0,0)}}",
      "@keyframes tutorial-ghost{0%,100%{opacity:.45;transform:scale(.85)}50%{opacity:1;transform:scale(1.08)}}",
      "@keyframes tutorial-sweep{from{left:15px}to{left:415px}}",
      "@media(max-width:520px){.tutorial-board{height:165px}.tutorial-copy{min-height:82px}.tutorial-node{left:36px}.tutorial-target{left:auto;right:54px}.tutorial-ghost{left:auto;right:62px}.tutorial-route{left:58px;width:210px}.tutorial-finger{left:250px}.tutorial-bonus{transform:scale(.86)}.bonus-shield{left:30px}.bonus-slow{left:128px}.bonus-cache{right:30px;transform:scale(.86) rotate(45deg)}}",
      "@media(prefers-reduced-motion:reduce){.tutorial-node,.tutorial-ghost,.tutorial-finger,.tutorial-gc-line{animation:none}}",
    ].join("");
    document.head.appendChild(style);
  }

  function installTutorial() {
    const stage = document.getElementById("stage");
    const start = document.getElementById("startScreen");
    const play = document.getElementById("startBtn");
    if (!stage || !start || !play) return;

    installStyles();

    const menuButton = document.createElement("button");
    menuButton.id = "tutorialBtn";
    menuButton.className = "tutorial-menu-btn";
    menuButton.textContent = "TUTORIAL";
    menuButton.setAttribute("aria-label", "Open tutorial");
    play.parentElement.appendChild(menuButton);

    const screen = document.createElement("section");
    screen.id = "tutorialScreen";
    screen.className = "overlay hidden";
    screen.setAttribute("role", "dialog");
    screen.setAttribute("aria-modal", "true");
    screen.setAttribute("aria-labelledby", "tutorialTitle");
    screen.innerHTML =
      '<div class="tutorial-shell">' +
        '<div class="tutorial-kicker" id="tutorialKicker"></div>' +
        '<h1 id="tutorialTitle"></h1>' +
        '<div class="tutorial-board" id="tutorialBoard" aria-hidden="true"></div>' +
        '<p class="tutorial-copy" id="tutorialCopy"></p>' +
        '<p class="tutorial-note" id="tutorialNote"></p>' +
        '<div class="tutorial-dots" id="tutorialDots" aria-label="Tutorial progress"></div>' +
        '<div class="tutorial-actions">' +
          '<button id="tutorialSkip" class="tutorial-skip">SKIP</button>' +
          '<button id="tutorialBack" class="tutorial-skip">BACK</button>' +
          '<button id="tutorialNext">NEXT</button>' +
        '</div>' +
      '</div>';
    stage.appendChild(screen);

    const dots = screen.querySelector("#tutorialDots");
    steps.forEach(() => {
      const dot = document.createElement("span");
      dot.className = "tutorial-dot";
      dots.appendChild(dot);
    });

    menuButton.addEventListener("click", () => openTutorial(false));
    screen.querySelector("#tutorialSkip").addEventListener("click", skipTutorial);
    screen.querySelector("#tutorialBack").addEventListener("click", () => {
      if (stepIndex > 0) { stepIndex--; renderStep(); }
    });
    screen.querySelector("#tutorialNext").addEventListener("click", () => {
      if (stepIndex < steps.length - 1) {
        stepIndex++;
        renderStep();
      } else {
        finishTutorial();
      }
    });
    screen.addEventListener("keydown", event => {
      if (event.key === "Escape") skipTutorial();
      if (event.key === "ArrowRight") screen.querySelector("#tutorialNext").click();
      if (event.key === "ArrowLeft" && stepIndex > 0) screen.querySelector("#tutorialBack").click();
    });

    if (!readComplete()) requestAnimationFrame(() => openTutorial(true));

    Object.defineProperty(window, "__echoStepsTutorialTest", {
      value:Object.freeze({
        snapshot:() => ({
          open:!screen.classList.contains("hidden"),
          step:stepIndex,
          completed:readComplete(),
          firstRun,
        }),
        open:() => openTutorial(false),
        reset:() => {
          try { localStorage.removeItem(STORAGE_KEY); } catch (error) {}
        },
      }),
    });
  }

  function renderStep() {
    const screen = document.getElementById("tutorialScreen");
    if (!screen) return;
    const step = steps[stepIndex];
    screen.querySelector("#tutorialKicker").textContent = step.kicker;
    screen.querySelector("#tutorialTitle").textContent = step.title;
    screen.querySelector("#tutorialTitle").style.color = step.accent;
    screen.querySelector("#tutorialCopy").textContent = step.body;
    screen.querySelector("#tutorialNote").textContent = step.note;
    screen.querySelector("#tutorialBoard").innerHTML = visualMarkup(step.visual);
    screen.querySelectorAll(".tutorial-dot").forEach((dot, index) => dot.classList.toggle("active", index === stepIndex));
    screen.querySelector("#tutorialBack").disabled = stepIndex === 0;
    screen.querySelector("#tutorialNext").textContent = stepIndex === steps.length - 1 ? "START PLAYING" : "NEXT";
    screen.querySelector("#tutorialSkip").textContent = firstRun ? "SKIP" : "CLOSE";
  }

  function openTutorial(isFirstRun) {
    const screen = document.getElementById("tutorialScreen");
    const start = document.getElementById("startScreen");
    if (!screen || !start) return;
    lastFocus = document.activeElement;
    firstRun = !!isFirstRun;
    stepIndex = 0;
    start.classList.add("hidden");
    screen.classList.remove("hidden");
    renderStep();
    screen.querySelector("#tutorialNext").focus();
  }

  function closeTutorial() {
    const screen = document.getElementById("tutorialScreen");
    const start = document.getElementById("startScreen");
    if (!screen || !start) return;
    screen.classList.add("hidden");
    start.classList.remove("hidden");
    firstRun = false;
    const fallback = document.getElementById("tutorialBtn");
    (lastFocus && document.contains(lastFocus) ? lastFocus : fallback)?.focus();
  }

  function skipTutorial() {
    rememberComplete();
    closeTutorial();
  }

  function finishTutorial() {
    rememberComplete();
    closeTutorial();
    document.getElementById("startBtn")?.click();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installTutorial, { once:true });
  else installTutorial();
})();
