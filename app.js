/*
 * Логика приложения. Редактировать не нужно — все тексты в config.js.
 */

const STORAGE_KEY = "bg3quest_state_v1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* игнорируем повреждённое хранилище */ }
  return {
    screen: "titleSplash",
    health: CONFIG.stats.healthStart,
    healthMax: CONFIG.stats.healthMax,
    gold: CONFIG.stats.goldStart,
    recruited: {},
    dialogueStep: {},
    dialogueApproval: {},
    activeCompanionId: null,
    attackUsed: {},
    chapter2Done: false,
    chapter2RewardClaimed: false,
    restChoice: null,
    restDone: false,
    legendStage: 0,
    legendUnread: false,
    gearDone: false,
    gearBudgetExtra: 0,
    mapPieceCount: 0,
    seenAct2Splash: false,
    seenAct4Splash: false,
    seenAct5Splash: false,
    newspaperIssues: [],
    goldLog: [],
    healthLog: [
      { delta: CONFIG.stats.healthStart - CONFIG.stats.healthMax, label: CONFIG.stats.fallLabel },
    ],
    _sparringCompanionId: null,
    _sparringStep: null,
    finalBattleDone: false,
  };
}

let state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------- Блокировка выхода из диалога ----------
function goTo(screen) {
  const current = state.screen;
  if (current && current.startsWith("companionDialogue:") && screen.startsWith("companionDialogue:") && screen !== current) {
    return;
  }
  state.screen = screen;
  saveState();
  render();
  // Скрыть/показать рамку
  const frame = document.querySelector('.page-frame');
  if (frame) {
    if (screen === 'titleSplash' || screen === 'finalVictory') {
      frame.style.display = 'none';
    } else {
      frame.style.display = 'block';
    }
  }
}

function addGold(amount, label) {
  state.gold += amount;
  state.goldLog.push({ delta: amount, label: label || "" });
  saveState();
}

function setHealth(value, label) {
  const clamped = Math.max(0, Math.min(state.healthMax, value));
  const delta = clamped - state.health;
  if (delta !== 0) {
    state.healthLog.push({ delta: delta, label: label || "" });
  }
  state.health = clamped;
  saveState();
}

// ---------- NFC ----------
async function tryNfcScan(expectedCode, onSuccess, onError) {
  if (!("NDEFReader" in window)) {
    onError("На этом телефоне нет поддержки чтения меток в браузере. Впиши слово вручную.");
    return;
  }
  try {
    const reader = new NDEFReader();
    await reader.scan();
    onError("Поднеси телефон к метке...");
    reader.onreading = (event) => {
      let text = "";
      for (const record of event.message.records) {
        if (record.recordType === "text") {
          const decoder = new TextDecoder(record.encoding || "utf-8");
          text += decoder.decode(record.data);
        } else if (record.recordType === "url") {
          text += new TextDecoder().decode(record.data);
        }
      }
      if (text.trim() === expectedCode) {
        onSuccess();
      } else {
        onError("Метка не подходит для этого этапа.");
      }
    };
  } catch (e) {
    onError("Не удалось включить чтение меток (" + e.message + "). Впиши слово вручную.");
  }
}

function normalize(str) {
  return str.trim().toUpperCase();
}

// ---------- Рендер ----------
const app = document.getElementById("app");

function render() {
  app.innerHTML = "";
  const routes = {
    titleSplash: renderTitleSplash,
    intro: renderIntro,
    breakfast: renderBreakfast,
    breakfastSuccess: renderBreakfastSuccess,
    plateClue: renderPlateClue,
    train: renderTrain,
    hub: renderHub,
    roster: renderRoster,
    newspaper: renderNewspaper,
    goldHistory: renderGoldHistory,
    healthHistory: renderHealthHistory,
    chapter2Intro: renderChapter2Intro,
    chapter2Photo: renderChapter2Photo,
    chapter2Submitted: renderChapter2Submitted,
    chapter2Praise: renderChapter2Praise,
    chapter2ClaimReward: renderChapter2ClaimReward,
    chapter2Reward: renderChapter2Reward,
    restChoice: renderRestChoice,
    restRoute: renderRestRoute,
    restPhoto: renderRestPhoto,
    restSubmitted: renderRestSubmitted,
    legendLetter: renderLegendLetter,
    gearPuzzle: renderGearPuzzle,
    gearMap: renderGearMap,
    gearBudget: renderGearBudget,
    gearPhoto: renderGearPhoto,
    gearPhotoSubmitted: renderGearPhotoSubmitted,
    finalBattleIntro: renderFinalBattleIntro,
    finalPhoto: renderFinalPhoto,
    finalBattleDone: renderFinalBattleDone,
    finalVictory: renderFinalVictory,
    actSplash2: renderActSplash2,
    actSplash4: renderActSplash4,
    actSplash5: renderActSplash5,
    sparring: renderSparring,
  };
  if (state.screen.startsWith("companionApproach:")) {
    renderCompanionApproach(state.screen.split(":")[1]);
  } else if (state.screen.startsWith("companionDialogue:")) {
    renderCompanionDialogue(state.screen.split(":")[1]);
  } else if (state.screen.startsWith("mapPiece:")) {
    renderMapPiece(state.screen.split(":")[1]);
  } else {
    (routes[state.screen] || renderIntro)();
  }
  updateHealthFooter();
  // Скрыть/показать рамку
  const frame = document.querySelector('.page-frame');
  if (frame) {
    if (state.screen === 'titleSplash' || state.screen === 'finalVictory') {
      frame.style.display = 'none';
    } else {
      frame.style.display = 'block';
    }
  }
}

// ---------- Нижняя полоска здоровья (пролог) ----------
const PROLOGUE_SCREENS = ["intro", "breakfast", "breakfastSuccess", "plateClue", "train"];

function updateHealthFooter() {
  const footerEl = document.getElementById("health-footer");
  const show = PROLOGUE_SCREENS.includes(state.screen);
  app.classList.toggle("has-footer", show);
  if (!show) {
    footerEl.innerHTML = "";
    return;
  }
  const pct = Math.round((state.health / state.healthMax) * 100);
  footerEl.innerHTML = `
    <div class="health-footer">
      <div class="health-footer-inner">
        <span class="health-footer-label">Здоровье</span>
        <div class="health-bar-track"><div class="health-bar-fill" style="width:${pct}%"></div></div>
        <span class="health-footer-value">${state.health}/${state.healthMax}</span>
      </div>
    </div>
  `;
}

// ---------- Вспомогательные функции ----------
function banner(eyebrow, title) {
  const el = document.createElement("div");
  el.className = "chapter-banner";
  el.innerHTML = `<p class="chapter-eyebrow">${eyebrow}</p><h1 class="chapter-title">${title}</h1>`;
  return el;
}

function screenWrap(children) {
  const s = document.createElement("div");
  s.className = "screen";
  children.forEach((c) => c && s.appendChild(c));
  return s;
}

function btn(text, onClick, variant) {
  const b = document.createElement("button");
  b.className = "btn" + (variant ? " " + variant : "");
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}

function p(text, className) {
  const el = document.createElement("p");
  el.className = className || "lore-text";
  el.innerHTML = text;
  return el;
}

function statusMsg(text, kind) {
  const el = document.createElement("div");
  el.className = "status-msg " + kind;
  el.textContent = text;
  return el;
}

function noteCard(title, bodyHtml) {
  const el = document.createElement("div");
  el.className = "note-card";
  el.innerHTML = `
    <div class="note-corner tl"></div>
    <div class="note-corner tr"></div>
    <div class="note-corner bl"></div>
    <div class="note-corner br"></div>
    <div class="note-title">${title}</div>
    ${bodyHtml}
  `;
  return el;
}

function findCompanion(id) {
  return CONFIG.companions.find((c) => c.id === id);
}

function portraitImg(src, alt) {
  const img = document.createElement("img");
  img.src = src;
  img.alt = alt;
  img.onerror = function () {
    this.onerror = null;
    this.replaceWith(portraitFallback(src));
  };
  return img;
}

function portraitFallback(src) {
  const el = document.createElement("div");
  el.className = "vn-portrait-placeholder";
  el.innerHTML = `Портрет не найден<br><span style="opacity:.6">(${src})</span>`;
  return el;
}

// ---------- Пролог ----------
function renderIntro() {
  const c = CONFIG.intro;
  app.appendChild(banner(c.eyebrow, c.title));
  app.appendChild(screenWrap([
    p(c.text),
    btn(c.buttonText, () => goTo("breakfast"), "primary"),
  ]));
}

function renderBreakfast() {
  const c = CONFIG.breakfast;
  app.appendChild(banner(c.eyebrow, c.title));

  const errorSlot = document.createElement("div");
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = c.passwordPlaceholder;
  input.autocomplete = "off";

  const submit = btn("Проверить", () => {
    errorSlot.innerHTML = "";
    if (normalize(input.value) === normalize(c.password)) {
      goTo("breakfastSuccess");
    } else {
      errorSlot.appendChild(statusMsg(c.errorText, "error"));
    }
  }, "primary");

  app.appendChild(screenWrap([
    p(c.text),
    document.createElement("div"),
    (() => { const l = document.createElement("p"); l.className = "field-label"; l.textContent = "Слово-ключ"; return l; })(),
    input,
    submit,
    errorSlot,
  ]));
}

function renderBreakfastSuccess() {
  const c = CONFIG.breakfast;
  app.appendChild(banner(c.eyebrow, c.title));
  app.appendChild(screenWrap([
    statusMsg(c.successText, "ok"),
    btn(c.eatButtonText, () => {
      setHealth(CONFIG.stats.healthAfterBreakfast, CONFIG.stats.breakfastLabel);
      goTo("plateClue");
    }, "primary"),
  ]));
}

function renderPlateClue() {
  const c = CONFIG.plateClue;
  app.appendChild(banner(c.eyebrow, c.title));

  const statusSlot = document.createElement("div");
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = c.passwordPlaceholder;
  input.autocomplete = "off";

  const onSuccess = () => goTo("train");
  const onFail = (msg) => {
    statusSlot.innerHTML = "";
    statusSlot.appendChild(statusMsg(msg, "error"));
  };

  const nfcBtn = btn(c.nfcButtonText, () => tryNfcScan(c.nfcCode, onSuccess, onFail), "primary");
  const submit = btn("Проверить слово", () => {
    if (normalize(input.value) === normalize(c.password)) onSuccess();
    else onFail(c.errorText);
  });

  app.appendChild(screenWrap([
    p(c.text),
    nfcBtn,
    (() => { const hr = document.createElement("p"); hr.className = "nfc-hint"; hr.textContent = "— или —"; return hr; })(),
    input,
    submit,
    statusSlot,
  ]));
}

function renderTrain() {
  const c = CONFIG.train;
  app.appendChild(banner(c.eyebrow, c.title));

  const list = document.createElement("div");
  list.className = "train-list";
  const upcoming = nextDepartures(c.departures, 3);

  if (upcoming.length === 0) {
    list.appendChild(statusMsg(c.noneLeftText, "error"));
  } else {
    upcoming.forEach((t) => {
      const row = document.createElement("div");
      row.className = "train-row";
      row.innerHTML = `<span class="train-time">${t}</span><span class="train-note">${c.direction}</span>`;
      list.appendChild(row);
    });
  }

  const portalGroup = document.createElement("div");
  portalGroup.className = "tight-group";
  const portalBtn = btn(c.portalButtonText, () => goTo("hub"), "primary");
  const hint = document.createElement("p");
  hint.className = "footer-note";
  hint.textContent = c.portalButtonHint;
  portalGroup.appendChild(portalBtn);
  portalGroup.appendChild(hint);

  app.appendChild(screenWrap([p(c.text), list, portalGroup]));
}

function nextDepartures(list, count) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const withMinutes = list.map((t) => {
    const [h, m] = t.split(":").map(Number);
    return { label: t, minutes: h * 60 + m };
  });
  const upcoming = withMinutes.filter((t) => t.minutes >= nowMinutes);
  return upcoming.slice(0, count).map((t) => t.label);
}

// ---------- Хаб ----------
function statBox(label, valueHtml, extraClass, onClick) {
  const box = document.createElement("div");
  box.className = "stat-box" + (extraClass ? " " + extraClass : "") + (onClick ? " clickable" : "");
  box.innerHTML = `<span class="stat-label">${label}</span><span class="stat-value">${valueHtml}</span>`;
  if (onClick) box.addEventListener("click", onClick);
  return box;
}

function questDoneRow(title) {
  const row = document.createElement("div");
  row.className = "quest-done-row";
  row.innerHTML = `<span>${title}</span><span class="tick">✦</span>`;
  return row;
}

function renderHub() {
  const c = CONFIG.hub;
  const recruitedCount = Object.keys(state.recruited).length;
  const allRecruited = recruitedCount >= c.directions.length;

  const title = document.createElement("h1");
  title.className = "hub-title";
  title.textContent = CONFIG.adventureTitle;

  const healthPct = Math.round((state.health / state.healthMax) * 100);
  const statRow = document.createElement("div");
  statRow.className = "stat-row";
  statRow.appendChild(statBox("Золото", state.gold, "", () => goTo("goldHistory")));
  statRow.appendChild(statBox(
    "Здоровье",
    `<span class="${state.health <= 6 ? "health-low" : ""}">${state.health}/${state.healthMax}</span>`,
    "",
    () => goTo("healthHistory")
  ));
  statRow.appendChild(statBox("Компаньоны", recruitedCount, "", () => goTo("roster")));

  const healthBar = document.createElement("div");
  healthBar.className = "health-bar-track";
  healthBar.innerHTML = `<div class="health-bar-fill" style="width:${healthPct}%"></div>`;

  const children = [title, statRow, healthBar];

  // Квест на башни
  if (allRecruited) {
    if (state.chapter2Done) {
      children.push(questDoneRow(c.firstMission.title));
    } else {
      const mission = noteCard(c.firstMission.title, `<p>${c.firstMission.text}</p>`);
      mission.style.marginTop = "4px";
      children.push(mission, btn(CONFIG.chapter2.startButtonText, () => goTo("chapter2Intro"), "primary"));
    }
  }

  // Привал появляется сразу после награды, без письма
  if (state.chapter2RewardClaimed) {
    if (state.restDone) {
      children.push(questDoneRow(CONFIG.chapter4.hubCardTitle));
    } else {
      const c4 = CONFIG.chapter4;
      const card = noteCard(c4.hubCardTitle, `<p>${c4.hubCardText}</p>`);
      card.style.marginTop = "4px";
      children.push(card, btn(c4.startButtonText, () => goTo("restChoice"), "primary"));
    }
  }

  // Снаряжение появляется только после прочтения письма 2 (stage 2)
  if (state.restDone && state.legendStage >= 2 && !state.legendUnread) {
    if (state.gearDone) {
      children.push(questDoneRow(CONFIG.chapter5.hubCardTitle));
    } else {
      const c5 = CONFIG.chapter5;
      const card = noteCard(c5.hubCardTitle, `<p>${c5.hubCardText}</p>`);
      card.style.marginTop = "4px";
      children.push(card, btn(c5.startButtonText, () => goTo("gearPuzzle"), "primary"));
    }
  }

  // Финальная битва после письма 3
  if (state.gearDone && state.legendStage >= 3 && !state.legendUnread) {
    if (state.finalBattleDone) {
      children.push(questDoneRow(CONFIG.finalBattle.hubCardTitle));
    } else {
      const fb = CONFIG.finalBattle;
      const card = noteCard(fb.hubCardTitle, `<p>${fb.hubCardText}</p>`);
      card.style.marginTop = "4px";
      children.push(card, btn(fb.startButtonText, () => goTo("finalBattleIntro"), "primary"));
    }
  }

  // Направления для союзников
  if (!allRecruited) {
    const sectionLabel = document.createElement("p");
    sectionLabel.className = "field-label";
    sectionLabel.textContent = c.sectionLabel;

    const directionList = document.createElement("div");
    directionList.className = "direction-list";
    c.directions.forEach((d) => {
      const done = !!state.recruited[d.companionId];
      const b = document.createElement("button");
      b.className = "direction-btn" + (done ? " done" : "");
      b.innerHTML = `<span>${d.label}</span>${done ? '<span class="tick">✦ пройдено</span>' : ""}`;
      if (done) {
        b.disabled = true;
      } else {
        b.addEventListener("click", () => goTo("companionApproach:" + d.companionId));
      }
      directionList.appendChild(b);
    });

    children.push(sectionLabel, directionList);
  }

  const secondary = document.createElement("div");
  secondary.className = "hub-secondary";
  secondary.appendChild(btn(c.newspaperButtonText, () => goTo("newspaper"), "ghost"));
  const teamBtn = btn(c.teamButtonText + (state.legendUnread ? " ●" : ""), () => goTo("roster"), "ghost");
  secondary.appendChild(teamBtn);

  children.push(secondary);
  app.appendChild(screenWrap(children));
}

// ---------- Компаньоны ----------
function renderCompanionApproach(id) {
  const comp = findCompanion(id);
  if (!comp) { goTo("hub"); return; }

  app.appendChild(banner("Союзник", comp.name + "?"));

  const portrait = document.createElement("div");
  portrait.className = "vn-portrait-wrap";
  portrait.appendChild(portraitImg(comp.portrait, comp.name));

  app.appendChild(screenWrap([
    portrait,
    p(comp.approachText),
    btn(comp.approachButtonText, () => {
      state.activeCompanionId = id;
      if (state.dialogueStep[id] === undefined) state.dialogueStep[id] = 0;
      if (state.dialogueApproval[id] === undefined) state.dialogueApproval[id] = 0;
      saveState();
      goTo("companionDialogue:" + id);
    }, "primary"),
  ]));
}

function renderCompanionDialogue(id) {
  const comp = findCompanion(id);
  if (!comp) { goTo("hub"); return; }

  const step = state.dialogueStep[id] || 0;
  const approval = state.dialogueApproval[id] || 0;

  app.appendChild(banner("Союзник", comp.name));

  const portraitWrap = document.createElement("div");
  portraitWrap.className = "vn-portrait-wrap";
  const joined = step >= comp.dialogue.length;
  portraitWrap.appendChild(portraitImg(joined ? comp.portraitJoined : comp.portrait, comp.name));
  const approvalBadge = document.createElement("div");
  approvalBadge.className = "vn-approval";
  approvalBadge.textContent = `${comp.approvalIcon} ${approval}`;
  portraitWrap.appendChild(approvalBadge);

  if (joined) {
    const line = document.createElement("div");
    line.className = "vn-line";
    line.textContent = comp.joinedLine;

    const continueBtn = btn(comp.continueButtonText, () => {
      state.recruited[id] = approval;
      state.dialogueStep[id] = 0;
      state.dialogueApproval[id] = 0;
      addGold(CONFIG.goldRewards.companionRecruited, comp.name + " присоединился");
      state.activeCompanionId = null;
      saveState();
      goTo("mapPiece:" + id);
    }, "primary");

    app.appendChild(screenWrap([portraitWrap, line, continueBtn]));
    return;
  }

  const currentLine = comp.dialogue[step];
  const line = document.createElement("div");
  line.className = "vn-line";
  line.textContent = currentLine.line;

  const options = document.createElement("div");
  options.className = "vn-options";

  const attackUsed = state.attackUsed[id] || false;

  currentLine.options.forEach((opt) => {
    if (opt.text.toLowerCase().includes("атаковать") && attackUsed) {
      return;
    }
    const b = document.createElement("button");
    b.className = "vn-option";
    b.textContent = opt.text;
    b.addEventListener("click", () => {
      if (opt.text.toLowerCase().includes("атаковать")) {
        state.attackUsed[id] = true;
        state._sparringCompanionId = id;
        state._sparringStep = step;
        saveState();
        goTo("sparring");
        return;
      }
      state.dialogueApproval[id] = (state.dialogueApproval[id] || 0) + opt.approval;
      state.dialogueStep[id] = step + 1;
      saveState();
      render();
    });
    options.appendChild(b);
  });

  app.appendChild(screenWrap([portraitWrap, line, options]));
}

// ---------- Спарринг ----------
function renderSparring() {
  const id = state._sparringCompanionId;
  const step = state._sparringStep;
  if (!id || step === undefined) { goTo("hub"); return; }

  app.appendChild(banner("Спарринг", "Славный бой!"));

  const msg = document.createElement("div");
  msg.className = "scroll-card";
  msg.innerHTML = `<p>Славный был спарринг! Ты показал себя достойным противником.</p>`;

  app.appendChild(screenWrap([
    msg,
    btn("Продолжить диалог", () => {
      state._sparringCompanionId = null;
      state._sparringStep = null;
      goTo("companionDialogue:" + id);
    }, "primary"),
  ]));
}

// ---------- Ростер ----------
function renderRoster() {
  app.appendChild(banner("Отряд", "Команда"));

  const list = document.createElement("div");
  list.style.display = "flex";
  list.style.flexDirection = "column";
  list.style.gap = "10px";

  const ids = Object.keys(state.recruited);
  if (ids.length === 0) {
    list.appendChild((() => { const el = document.createElement("div"); el.className = "roster-empty"; el.textContent = "Пока никто не присоединился."; return el; })());
  } else {
    ids.forEach((id) => {
      const comp = findCompanion(id);
      if (!comp) return;
      const row = document.createElement("div");
      row.className = "roster-item";
      if (id === "legend" && state.legendUnread) {
        row.classList.add("roster-item--clickable");
        row.addEventListener("click", () => goTo("legendLetter"));
      }
      row.innerHTML = `
        <span class="roster-left">
          <img class="roster-portrait" src="${comp.portraitJoined}" alt="${comp.name}">
          <span>${comp.name}</span>
        </span>
        <span>${comp.approvalIcon} ${state.recruited[id]}${id === "legend" && state.legendUnread ? ' <span class="msg-badge">●</span>' : ''}</span>
      `;
      list.appendChild(row);
    });
  }

  app.appendChild(screenWrap([list, btn("Назад", () => goTo("hub"), "ghost")]));
}

// ---------- История золота / здоровья ----------
function renderGoldHistory() {
  renderLogScreen("Хроника", "История золота", state.goldLog, "");
}

function renderHealthHistory() {
  renderLogScreen("Хроника", "История здоровья", state.healthLog, "");
}

function renderLogScreen(eyebrow, title, log, unit) {
  app.appendChild(banner(eyebrow, title));

  const list = document.createElement("div");
  list.style.display = "flex";
  list.style.flexDirection = "column";
  list.style.gap = "8px";

  if (log.length === 0) {
    list.appendChild((() => { const el = document.createElement("div"); el.className = "roster-empty"; el.textContent = "Пока пусто."; return el; })());
  } else {
    log.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "log-row";
      const sign = entry.delta > 0 ? "+" : "";
      const cls = entry.delta >= 0 ? "positive" : "negative";
      row.innerHTML = `<span>${entry.label || "—"}</span><span class="log-delta ${cls}">${sign}${entry.delta} ${unit}</span>`;
      list.appendChild(row);
    });
  }

  app.appendChild(screenWrap([list, btn("Назад", () => goTo("hub"), "ghost")]));
}

// ---------- Письмо от Легенды (только этапы 2 и 3) ----------
function renderLegendLetter() {
  const stage = state.legendStage;
  const msg = CONFIG.legendMessages[stage];
  if (!msg) { goTo("hub"); return; }

  app.appendChild(banner("Письмо", "Легенда"));

  const letter = document.createElement("div");
  letter.className = "scroll-card";
  letter.innerHTML = `<p>${msg.text}</p>`;

  app.appendChild(screenWrap([
    letter,
    btn(msg.buttonText, () => {
      state.legendUnread = false;
      saveState();
      let splashScreen = null;
      if (stage === 2) splashScreen = "actSplash4";
      else if (stage === 3) splashScreen = "actSplash5";
      if (splashScreen) {
        goTo(splashScreen);
      } else {
        goTo("hub");
      }
    }, "primary"),
  ]));
}

// ---------- Кусок карты ----------
function renderMapPiece(id) {
  const piece = CONFIG.mapPieces[id];
  if (!piece) { goTo("hub"); return; }

  app.appendChild(banner("Находка", "Часть карты"));

  const emoji = document.createElement("p");
  emoji.style.fontSize = "48px";
  emoji.style.textAlign = "center";
  emoji.style.margin = "10px 0";
  emoji.textContent = piece.emoji;

  const actionBtn = btn(CONFIG.mapPieceButtonText, () => {
    state.mapPieceCount = (state.mapPieceCount || 0) + 1;
    saveState();
    if (id === "towers") {
      goTo("chapter2ClaimReward");
    } else if (id === "rest") {
      proceedAfterMapPiece(id);
    } else {
      proceedAfterMapPiece(id);
    }
  }, "primary");

  app.appendChild(screenWrap([
    p(piece.text),
    emoji,
    actionBtn,
  ]));
}

function proceedAfterMapPiece(id) {
  if (id === "rest") {
    // после отдыха сразу хаб, без письма и сплэша
    goTo("hub");
    return;
  }
  // для компаньонов
  const allRecruited = Object.keys(state.recruited).length >= CONFIG.hub.directions.length;
  if (allRecruited && !state.seenAct2Splash) {
    state.seenAct2Splash = true;
    saveState();
    goTo("actSplash2");
  } else {
    goTo("hub");
  }
}

// ---------- Газета ----------
function newspaperIssueBlock(issue) {
  const wrap = document.createElement("div");
  wrap.className = "newspaper-issue";

  const collapsible = document.createElement("button");
  collapsible.type = "button";
  collapsible.className = "newspaper-collapsible";
  collapsible.setAttribute("aria-expanded", "false");

  const img = document.createElement("img");
  img.src = issue.fullImage;
  img.alt = issue.title;
  collapsible.appendChild(img);

  let isOpen = false;

  function applyHeight() {
    if (!img.naturalWidth) return;
    const renderedWidth = collapsible.clientWidth;
    const scale = renderedWidth / img.naturalWidth;
    const collapsedPx = CONFIG.newspaper.foldHeight * scale;
    const fullPx = img.naturalHeight * scale;
    collapsible.style.maxHeight = (isOpen ? fullPx : collapsedPx) + "px";
  }

  if (img.complete) applyHeight();
  img.addEventListener("load", applyHeight);
  window.addEventListener("resize", applyHeight);

  collapsible.addEventListener("click", () => {
    isOpen = !isOpen;
    collapsible.setAttribute("aria-expanded", String(isOpen));
    applyHeight();
  });

  wrap.appendChild(collapsible);
  return wrap;
}

function renderNewspaper() {
  const c = CONFIG.newspaper;
  app.appendChild(banner("Пресса", c.title));

  const staticIssues = c.staticIssues || [];
  const dynamicIssues = state.newspaperIssues || [];
  const allIssues = [...staticIssues, ...dynamicIssues];

  const list = document.createElement("div");
  list.style.display = "flex";
  list.style.flexDirection = "column";
  list.style.gap = "18px";

  if (allIssues.length === 0) {
    list.appendChild(statusMsg(c.emptyText, "error"));
  } else {
    allIssues.forEach((issue) => list.appendChild(newspaperIssueBlock(issue)));
  }

  app.appendChild(screenWrap([list, btn("Назад", () => goTo("hub"), "ghost")]));
}

// ---------- Глава 2 ----------
function renderChapter2Intro() {
  const c = CONFIG.chapter2;
  app.appendChild(banner(c.eyebrow, c.title));
  app.appendChild(screenWrap([
    p(c.intro.text),
    btn(c.intro.buttonText, () => goTo("chapter2Photo"), "primary"),
  ]));
}

function renderChapter2Photo() {
  const c = CONFIG.chapter2;
  app.appendChild(banner(c.eyebrow, c.title));

  const heading = document.createElement("h3");
  heading.style.margin = "0";
  heading.style.fontFamily = "var(--font-display)";
  heading.style.fontVariant = "small-caps";
  heading.textContent = c.photo.title;

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.capture = "environment";
  fileInput.style.display = "none";

  const statusSlot = document.createElement("div");
  const uploadBtn = btn(c.photo.uploadButtonText, () => fileInput.click(), "primary");

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    statusSlot.innerHTML = "";
    statusSlot.appendChild(statusMsg("Обрабатываю фото...", "ok"));
    composeNewspaperIssue(file, c.newIssue)
      .then((issue) => {
        state.newspaperIssues.push(issue);
        state.chapter2Done = true;
        saveState();
        goTo("chapter2Submitted");
      })
      .catch((err) => {
        statusSlot.innerHTML = "";
        statusSlot.appendChild(statusMsg("Не получилось обработать фото: " + err.message, "error"));
      });
  });

  app.appendChild(screenWrap([heading, p(c.photo.text), uploadBtn, fileInput, statusSlot]));
}

function renderChapter2Submitted() {
  const c = CONFIG.chapter2;
  app.appendChild(banner(c.eyebrow, c.title));
  app.appendChild(screenWrap([
    statusMsg(c.submittedText, "ok"),
    btn(c.continueButtonText, () => goTo("chapter2Praise"), "primary"),
  ]));
}

function renderChapter2Praise() {
  const c = CONFIG.chapter2.praise;
  app.appendChild(banner(c.eyebrow, c.title));
  app.appendChild(screenWrap([
    p(c.text),
    btn(c.buttonText, () => goTo("mapPiece:towers"), "primary")
  ]));
}

function renderChapter2ClaimReward() {
  const c = CONFIG.chapter2.claimReward;
  app.appendChild(banner(CONFIG.chapter2.eyebrow, "Награда"));

  const statusSlot = document.createElement("div");
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = c.passwordPlaceholder;
  input.autocomplete = "off";

  const onSuccess = () => goTo("chapter2Reward");
  const onFail = (msg) => {
    statusSlot.innerHTML = "";
    statusSlot.appendChild(statusMsg(msg, "error"));
  };

  const nfcBtn = btn(c.nfcButtonText, () => tryNfcScan(c.nfcCode, onSuccess, onFail), "primary");
  const submit = btn("Проверить слово", () => {
    if (normalize(input.value) === normalize(c.password)) onSuccess();
    else onFail(c.errorText);
  });

  app.appendChild(screenWrap([
    p(c.text),
    nfcBtn,
    (() => { const hr = document.createElement("p"); hr.className = "nfc-hint"; hr.textContent = "— или —"; return hr; })(),
    input,
    submit,
    statusSlot,
  ]));
}

function renderChapter2Reward() {
  const c = CONFIG.chapter2.reward;

  if (!state.chapter2RewardClaimed) {
    addGold(c.amount, c.goldLogLabel);
    state.chapter2RewardClaimed = true;
    // больше не ставим legendStage = 1, привал появляется сразу
    saveState();
  }

  app.appendChild(banner(c.eyebrow, c.title));

  const amountEl = document.createElement("p");
  amountEl.className = "hub-title";
  amountEl.style.margin = "0";
  amountEl.textContent = `+${c.amount} ${c.amountLabel}`;

  app.appendChild(screenWrap([
    amountEl,
    p(c.text),
    btn(c.walletButtonText, () => goTo("goldHistory"), "primary"),
  ]));
}

// ---------- Фото в газету ----------
function composeNewspaperIssue(file, issueConfig) {
  const c = issueConfig;

  return new Promise((resolve, reject) => {
    const templateImg = new Image();
    templateImg.onload = () => {
      const photoImg = new Image();
      const reader = new FileReader();
      reader.onload = () => {
        photoImg.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = templateImg.width;
            canvas.height = templateImg.height;
            const ctx = canvas.getContext("2d");

            ctx.drawImage(templateImg, 0, 0);

            const box = c.photoBox;
            const srcRatio = photoImg.width / photoImg.height;
            const boxRatio = box.width / box.height;
            let sx, sy, sw, sh;
            if (srcRatio > boxRatio) {
              sh = photoImg.height;
              sw = sh * boxRatio;
              sx = (photoImg.width - sw) / 2;
              sy = 0;
            } else {
              sw = photoImg.width;
              sh = sw / boxRatio;
              sx = 0;
              sy = (photoImg.height - sh) / 2;
            }

            ctx.save();
            ctx.filter = "grayscale(1) contrast(1.1) brightness(0.95)";
            ctx.drawImage(photoImg, sx, sy, sw, sh, box.x, box.y, box.width, box.height);
            ctx.restore();

            const fullDataUrl = canvas.toDataURL("image/jpeg", 0.85);

            resolve({
              id: "issue-" + Date.now(),
              title: c.title,
              fullImage: fullDataUrl,
            });
          } catch (e) {
            reject(e);
          }
        };
        photoImg.onerror = () => reject(new Error("не удалось прочитать фото"));
        photoImg.src = reader.result;
      };
      reader.onerror = () => reject(new Error("не удалось прочитать файл"));
      reader.readAsDataURL(file);
    };
    templateImg.onerror = () => reject(new Error("не удалось загрузить шаблон газеты"));
    templateImg.src = c.templateImage;
  });
}

// ---------- Глава 4 (Долгий отдых) ----------
function renderRestChoice() {
  const c = CONFIG.chapter4;
  app.appendChild(banner(c.eyebrow, c.title));

  const optionList = document.createElement("div");
  optionList.className = "direction-list";
  c.options.forEach((opt) => {
    const b = document.createElement("button");
    b.className = "direction-btn";
    // Исправлено: теперь внутри кнопки название и описание идут друг под другом
    b.innerHTML = `<div style="display:block; text-align:left; width:100%;">
      <span style="font-size:1em;">${opt.name}</span><br>
      <span style="font-size:0.75em; opacity:0.8;">${opt.flavor}</span>
    </div>`;
    b.addEventListener("click", () => {
      state.restChoice = opt.id;
      saveState();
      goTo("restRoute");
    });
    optionList.appendChild(b);
  });

  app.appendChild(screenWrap([p(c.choiceText), optionList]));
}

function renderRestRoute() {
  const c = CONFIG.chapter4;
  const opt = c.options.find((o) => o.id === state.restChoice) || c.options[0];
  app.appendChild(banner(c.eyebrow, opt.name));

  const addressLink = document.createElement("p");
  addressLink.className = "lore-text";
  addressLink.innerHTML = `📍 <a href="${opt.mapLink}" target="_blank" style="color: var(--gold-bright); text-decoration: underline;">${opt.address}</a>`;

  app.appendChild(screenWrap([
    p(opt.flavor),
    addressLink,
    btn(c.startButtonText2, () => goTo("restPhoto"), "primary"),
  ]));
}

function renderRestPhoto() {
  const c = CONFIG.chapter4;
  const opt = c.options.find((o) => o.id === state.restChoice) || c.options[0];
  const issueConfig = opt.newIssue || c.newIssue;

  app.appendChild(banner(c.eyebrow, c.photo.title));

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.capture = "environment";
  fileInput.style.display = "none";

  const statusSlot = document.createElement("div");
  const uploadBtn = btn(c.photo.uploadButtonText, () => fileInput.click(), "primary");

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    statusSlot.innerHTML = "";
    statusSlot.appendChild(statusMsg("Обрабатываю фото...", "ok"));
    composeNewspaperIssue(file, issueConfig)
      .then((issue) => {
        state.newspaperIssues.push(issue);
        saveState();
        goTo("restSubmitted");
      })
      .catch((err) => {
        statusSlot.innerHTML = "";
        statusSlot.appendChild(statusMsg("Не получилось обработать фото: " + err.message, "error"));
      });
  });

  app.appendChild(screenWrap([p(c.photo.text), uploadBtn, fileInput, statusSlot]));
}

function renderRestSubmitted() {
  const c = CONFIG.chapter4;
  app.appendChild(banner(c.eyebrow, c.title));
  app.appendChild(screenWrap([
    statusMsg(c.submittedText, "ok"),
    btn(c.finishButtonText, () => {
      state.restDone = true;
      // После отдыха ставим письмо 2 (этап 2)
      state.legendStage = 2;
      state.legendUnread = true;
      saveState();
      goTo("hub");
    }, "primary"),
  ]));
}

// ---------- Глава 5 (Снаряжение) ----------
let gearPuzzleOrder = [];

function renderGearPuzzle() {
  const c = CONFIG.chapter5.puzzle;
  app.appendChild(banner(CONFIG.chapter5.eyebrow, c.title));

  gearPuzzleOrder = [];

  const grid = document.createElement("div");
  grid.className = "gear-puzzle-grid";

  const statusSlot = document.createElement("div");

  const shuffled = c.pieces.map((piece, i) => ({ piece, i })).sort(() => Math.random() - 0.5);

  shuffled.forEach(({ piece, i }) => {
    const tile = document.createElement("button");
    tile.className = "gear-puzzle-tile";
    const img = document.createElement("img");
    img.src = piece.image;
    img.alt = "Кусок карты";
    img.style.width = "100%";
    img.style.height = "auto";
    tile.appendChild(img);
    tile.addEventListener("click", () => {
      if (tile.disabled) return;
      const expectedNext = gearPuzzleOrder.length;
      if (i === expectedNext) {
        tile.disabled = true;
        tile.classList.add("done");
        gearPuzzleOrder.push(i);
        if (gearPuzzleOrder.length === c.pieces.length) {
          setTimeout(() => goTo("gearMap"), 400);
        }
      } else {
        statusSlot.innerHTML = "";
        statusSlot.appendChild(statusMsg(c.mistakeText, "error"));
        gearPuzzleOrder = [];
        grid.querySelectorAll(".gear-puzzle-tile").forEach((t) => {
          t.disabled = false;
          t.classList.remove("done");
        });
      }
    });
    grid.appendChild(tile);
  });

  app.appendChild(screenWrap([p(c.instructions), grid, statusSlot]));
}

function renderGearMap() {
  const c = CONFIG.chapter5;
  app.appendChild(banner(c.eyebrow, "Карта собрана"));

  const mapImg = document.createElement("img");
  mapImg.src = c.puzzle.completeMapImage;
  mapImg.alt = "Собранная карта";
  mapImg.style.width = "100%";
  mapImg.style.borderRadius = "4px";
  mapImg.style.marginBottom = "10px";

  const addressLink = document.createElement("p");
  addressLink.className = "lore-text";
  addressLink.innerHTML = `📍 <a href="${c.mapLink}" target="_blank" style="color: var(--gold-bright); text-decoration: underline;">${c.mapAddress}</a>`;

  app.appendChild(screenWrap([
    mapImg,
    addressLink,
    btn(c.mapButtonText, () => goTo("gearBudget"), "primary"),
  ]));
}

function renderGearBudget() {
  const c = CONFIG.chapter5.budget;
  app.appendChild(banner(CONFIG.chapter5.eyebrow, "Закуп перед боем"));

  app.appendChild(screenWrap([
    p(c.text),
    btn("Я закупился", () => goTo("gearPhoto"), "primary"),
  ]));
}

function renderGearPhoto() {
  const c = CONFIG.chapter5;
  app.appendChild(banner(c.eyebrow, c.photo.title));

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.capture = "environment";
  fileInput.style.display = "none";

  const statusSlot = document.createElement("div");
  const uploadBtn = btn(c.photo.uploadButtonText, () => fileInput.click(), "primary");

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    statusSlot.innerHTML = "";
    statusSlot.appendChild(statusMsg("Обрабатываю фото...", "ok"));
    composeNewspaperIssue(file, c.newIssue)
      .then((issue) => {
        state.newspaperIssues.push(issue);
        state.gearDone = true;
        saveState();
        goTo("gearPhotoSubmitted");
      })
      .catch((err) => {
        statusSlot.innerHTML = "";
        statusSlot.appendChild(statusMsg("Не получилось обработать фото: " + err.message, "error"));
      });
  });

  app.appendChild(screenWrap([p(c.photo.text), uploadBtn, fileInput, statusSlot]));
}

function renderGearPhotoSubmitted() {
  const c = CONFIG.chapter5;
  app.appendChild(banner(c.eyebrow, "Снаряжение завершено"));
  app.appendChild(screenWrap([
    statusMsg(c.gearPhotoSubmitted || "Фото сохранено!", "ok"),
    btn(c.gearPhotoContinue || "Продолжить", () => {
      // После сборов ставим письмо 3 (этап 3)
      state.legendStage = 3;
      state.legendUnread = true;
      saveState();
      goTo("hub");
    }, "primary"),
  ]));
}

// ---------- Финальная битва ----------
function renderFinalBattleIntro() {
  const fb = CONFIG.finalBattle;
  app.appendChild(banner(fb.eyebrow, fb.title));
  app.appendChild(screenWrap([
    p(fb.intro.text),
    btn(fb.intro.buttonText, () => goTo("finalPhoto"), "primary"),
  ]));
}

function renderFinalPhoto() {
  const fb = CONFIG.finalBattle;
  app.appendChild(banner(fb.eyebrow, fb.photo.title));

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.capture = "environment";
  fileInput.style.display = "none";

  const statusSlot = document.createElement("div");
  const uploadBtn = btn(fb.photo.uploadButtonText, () => fileInput.click(), "primary");

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    statusSlot.innerHTML = "";
    statusSlot.appendChild(statusMsg("Обрабатываю фото...", "ok"));
    composeNewspaperIssue(file, fb.newIssue)
      .then((issue) => {
        state.newspaperIssues.push(issue);
        state.finalBattleDone = true;
        saveState();
        goTo("finalBattleDone");
      })
      .catch((err) => {
        statusSlot.innerHTML = "";
        statusSlot.appendChild(statusMsg("Не получилось обработать фото: " + err.message, "error"));
      });
  });

  app.appendChild(screenWrap([p(fb.photo.text), uploadBtn, fileInput, statusSlot]));
}

function renderFinalBattleDone() {
  const fb = CONFIG.finalBattle;
  setHealth(27, "Имениннику — полное здоровье!");

  app.appendChild(banner(fb.eyebrow, "Победа!"));
  app.appendChild(screenWrap([
    statusMsg(fb.battleDoneText || "Битва окончена! Ты спас мир! Твоё здоровье восстановлено до 27 — в честь дня рождения!", "ok"),
    btn("Сохранить газеты на память", () => {
      const allIssues = [...CONFIG.newspaper.staticIssues, ...state.newspaperIssues];
      allIssues.forEach((issue, index) => {
        const link = document.createElement("a");
        link.download = `newspaper_${index+1}.jpg`;
        link.href = issue.fullImage;
        link.click();
      });
    }, "primary"),
    btn(fb.finishButtonText, () => goTo("finalVictory"), "primary"),
  ]));
}

function renderFinalVictory() {
  const fb = CONFIG.finalBattle;
  const wrap = document.createElement("div");
  wrap.className = "title-splash";
  wrap.style.backgroundImage = `url("${fb.finalImage}")`;
  wrap.style.backgroundSize = "cover";
  wrap.style.backgroundPosition = "center";
  wrap.style.backgroundColor = "var(--bg-void)";
  wrap.style.display = "flex";
  wrap.style.alignItems = "flex-end";
  wrap.style.justifyContent = "center";
  wrap.style.padding = "0 0 48px";
  wrap.style.cursor = "default";

  const hint = document.createElement("p");
  hint.className = "title-splash-hint";
  hint.textContent = "Спасибо за игру!";
  wrap.appendChild(hint);

  app.appendChild(wrap);
}

// ---------- Сплэши актов ----------
function renderActSplashGeneric(actConfig, nextScreen) {
  const wrap = document.createElement("div");
  wrap.className = "act-splash";
  wrap.innerHTML = `
    <span class="act-splash-number">Акт ${actConfig.number}</span>
    <span class="act-splash-title">${actConfig.title}</span>
    <span class="act-splash-hint">Нажмите в любом месте</span>
  `;
  wrap.addEventListener("click", () => goTo(nextScreen));
  app.appendChild(wrap);
}

function renderActSplash2() {
  renderActSplashGeneric(CONFIG.acts.act2, "hub");
}
function renderActSplash4() {
  renderActSplashGeneric(CONFIG.acts.act4, "hub");
}
function renderActSplash5() {
  renderActSplashGeneric(CONFIG.acts.act5, "hub");
}

// ---------- Титульная заставка ----------
function renderTitleSplash() {
  const c = CONFIG.titleSplash;

  const wrap = document.createElement("div");
  wrap.className = "title-splash";
  wrap.style.backgroundImage = `url("${c.image}")`;

  const hint = document.createElement("p");
  hint.className = "title-splash-hint";
  hint.textContent = c.tapHint;
  wrap.appendChild(hint);

  wrap.addEventListener("click", () => goTo("intro"));
  app.appendChild(wrap);
}

// ---------- Старт ----------
if (state.activeCompanionId) {
  const comp = findCompanion(state.activeCompanionId);
  if (comp && state.dialogueStep[state.activeCompanionId] < comp.dialogue.length) {
    state.screen = "companionDialogue:" + state.activeCompanionId;
    saveState();
  } else {
    state.activeCompanionId = null;
    saveState();
  }
}

render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}