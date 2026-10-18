import { ACHIEVEMENTS, ARIN, NEED, ORDER, QUESTS, TAMO } from "./content.js";
import { onDock, surfaceAt } from "./world.js";
import { audio } from "./audio.js";

const TALK = 2.4;
const REACH = 1.9;
const SPEED = 4.6;
const DAY_LEN = 480; // detik per 24 jam
const HOUSE_NEED = NEED.house;

export function createSim(world) {
  const sim = {
    x: 0,
    z: -14.2,
    y: 0.9,
    yaw: 0,
    pitch: -0.1,
    walk: 0,
    moving: false,
    running: false,
    started: false,
    paused: false,
    lookLocked: false,
    craftOpen: false,
    ended: false,
    quest: "talk",
    hour: 8.2,
    day: 1,
    dialog: null,
    focus: null,
    toast: null,
    inv: { log: 0, plank: 0, sand: 0, stone: 0, shell: 0 },
    built: { furnace: false, boat: false },
    houseStage: 0,
    houseQueue: [],
    houseAnim: 0,
    traded: { arin: false, tamo: false },
    ach: [],
    achQueue: [],
    catsPet: 0,
    chop: null,
    axe: false,
    repaired: false,
    sleepFade: 0,
    sleeping: false,
    sleepCard: null,
    // voyage
    phase: "island", // island | cut1 | sail | shark | patch | city | ending
    cut: null,
    boatBank: 0,
    voyageDist: 0,
    sailT: 0,
    sharkT: 0,
    patches: [false, false],
    sparePlanks: 0,
    patchHold: 0,
    patchIndex: 0,
    holdE: false,
    waterLevel: 0,
    cityBuilt: false,
    _who: null,
    _lines: null,
    _i: 0,
    _pending: null,
    _chopped: 0,
    _nextStage: 0,

    // ---------- quest ----------
    questView() {
      const q = QUESTS[this.quest] || QUESTS.done;
      const total = ORDER.length - 1;
      const step = Math.min(total, Math.max(0, ORDER.indexOf(this.quest)));
      let need = q.count ? NEED[q.count] : 0;
      let have = q.count ? this.inv[q.count] : 0;
      if (this.quest === "house") {
        need = HOUSE_NEED;
        have = this.houseStage;
      }
      const pct = need ? Math.min(1, have / need) : step / total;
      return {
        kicker: this.quest === "done" ? "Selesai" : `Langkah ${step + 1} / ${total}`,
        title: q.title,
        detail: q.count || this.quest === "house" ? `${q.detail}  ${have}/${need}` : q.detail,
        pct,
        showBar: this.quest === "chop" || this.quest === "house",
        dots: total,
        step,
      };
    },

    sideView() {
      const out = [];
      if (!this.traded.arin) out.push({ who: "arin", text: `Altar ${Math.min(this.inv.stone, 2)}/2 batu` });
      if (!this.traded.tamo) out.push({ who: "tamo", text: `Kerang ${Math.min(this.inv.shell, NEED.shell)}/${NEED.shell}` });
      return out;
    },

    clock() {
      const h = Math.floor(this.hour);
      const m = Math.floor((this.hour - h) * 60);
      const phase =
        this.hour < 4.5 ? "Malam" :
        this.hour < 6.5 ? "Subuh" :
        this.hour < 11 ? "Pagi" :
        this.hour < 15 ? "Siang" :
        this.hour < 17.8 ? "Sore" :
        this.hour < 19.6 ? "Senja" : "Malam";
      return { text: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, phase, night: world.night > 0.5, isNight: this.hour >= 19 || this.hour < 5 };
    },

    takeToast() {
      const t = this.toast;
      this.toast = null;
      return t;
    },

    stage() {
      return ORDER.indexOf(this.quest);
    },

    // ---------- targeting ----------
    nearest(list, reach, ok) {
      let best = null;
      let bestD = reach;
      for (const it of list) {
        if (ok && !ok(it)) continue;
        const d = Math.hypot(it.x - this.x, it.z - this.z);
        if (d < bestD) {
          bestD = d;
          best = it;
        }
      }
      return best;
    },

    target() {
      if (this.phase !== "island" && this.phase !== "cut1") {
        // at sea only patches are interactable
        if (this.phase === "patch") {
          return { kind: "patch", label: this.patchHold > 0 ? "Menambal…" : "Tahan E  tambal lubang" };
        }
        return null;
      }
      const cands = [];
      // Score = distance, minus a bonus when the player is facing the target.
      // That way the thing you look at wins ties instead of whatever happens
      // to be marginally closer (a cat sitting next to the tree you want).
      const push = (kind, list, reach, ok, label, bias = 0, faceBonus = 0.55) => {
        const it = this.nearest(list, reach, ok);
        if (!it) return;
        const dx = it.x - this.x;
        const dz = it.z - this.z;
        const dist = Math.hypot(dx, dz);
        let d = dist + bias;
        if (faceBonus) {
          const fx = Math.sin(this.yaw);
          const fz = Math.cos(this.yaw);
          const dot = dist > 0.001 ? (dx / dist) * fx + (dz / dist) * fz : 1;
          if (dot > 0.35) d -= faceBonus * Math.min(1, (dot - 0.35) / 0.65);
        }
        cands.push({ kind, ref: it, d, label: typeof label === "function" ? label(it) : label });
      };
      push("npc", world.npcs, TALK, null, (n) => `E  bicara ${n.name}`, -1.4);
      push("cat", world.cats, 1.5, null, (c) => `E  usap ${c.name}`);
      if (this.quest === "boat" || this.quest === "sail") {
        push("boat", [world.boat], 2.8, null, this.quest === "boat" ? "E  temui Tamo" : "E  berlayar");
      }
      push("tree", world.trees, REACH, (t) => !t.felled, () => (this.axe ? "E  tebang pohon" : "Butuh kapak dari Tamo"));
      push("rock", world.rocks, REACH, (r) => !r.mined, "E  ambil batu");
      push("sand", world.sands, REACH, (s) => !s.taken, "E  ambil pasir");
      push("shell", world.shells, REACH, (s) => !s.taken, "E  ambil kerang");
      // house plot
      const hx = world.housePos.x;
      const hz = world.housePos.z;
      const hd = Math.hypot(hx - this.x, hz - this.z);
      if (this.quest === "house" && hd < 3.6) {
        const can = this.inv.log > 0 && this.houseStage < HOUSE_NEED;
        cands.push({
          kind: "plot",
          ref: { x: hx, z: hz },
          d: hd - 2.2,
          label: can ? `E  taruh kayu  ${this.houseStage}/${HOUSE_NEED}` : `Butuh kayu  ${this.houseStage}/${HOUSE_NEED}`,
        });
      }
      // beds (once the house stands) — only while standing inside, so the
      // prompt can't outrank a cat or a tree through the wall
      if (this.houseStage >= 8) {
        const bed = this.nearestBed();
        const inside =
          Math.abs(this.x - world.housePos.x) < world.house.w / 2 &&
          Math.abs(this.z - world.housePos.z) < world.house.d / 2;
        if (inside && bed && Math.hypot(bed.x - this.x, bed.z - this.z) < 1.3) {
          cands.push({
            kind: "bed",
            ref: bed,
            d: Math.hypot(bed.x - this.x, bed.z - this.z) - 4.0,
            label: this.clock().isNight ? "E  tidur" : "Belum mengantuk · tidur bisa malam hari",
          });
        }
      }
      if (!cands.length) return null;
      cands.sort((a, b) => a.d - b.d);
      return cands[0];
    },

    nearestBed() {
      const beds = world.builds.house.userData.beds || [];
      let best = null;
      let bd = 1e9;
      for (const b of beds) {
        const d = Math.hypot(b.x - this.x, b.z - this.z);
        if (d < bd) { bd = d; best = b; }
      }
      return best;
    },

    promptText() {
      if (!this.started || this.dialog || this.ended || this.paused || this.craftOpen) return "";
      const t = this.target();
      return t ? t.label : "";
    },

    // ---------- achievements ----------
    unlock(id) {
      if (!id || this.ach.includes(id)) return;
      this.ach.push(id);
      this.achQueue.push(id);
    },
    takeAchievements() {
      const q = this.achQueue;
      this.achQueue = [];
      return q;
    },
    get achCount() {
      return this.ach.length;
    },

    // ---------- quest flow ----------
    setQuest(id) {
      if (this.quest === id) return;
      this.quest = id;
      this.toast = QUESTS[id] ? QUESTS[id].title : "Selesai";
      this.advanceGather();
    },

    advanceGather() {
      if (this.quest === "chop" && this.inv.log >= NEED.log) this.setQuest("house");
    },

    linesFor(npc) {
      const q = this.quest;
      const night = this.clock().isNight;
      if (npc.id === "tamo") {
        if (q === "talk") return TAMO.talk;
        if (q === "boat" || q === "sail") return TAMO.boat;
        if (q === "done") return TAMO.done;
        if (this.traded.tamo) return TAMO.after;
        if (this.inv.shell >= NEED.shell) {
          this._pending = "tamo";
          return TAMO.offer;
        }
        if (night && this.houseStage >= 8) return ["Sudah malam. Aku masuk rumah dulu.", "Kau juga, tidurlah. Besok kita berlayar."];
        return TAMO[q] || TAMO.idle;
      }
      if (npc.id === "arin") {
        if (this.traded.arin) return night ? ARIN.night : ARIN.after;
        if (this.inv.stone >= 2) {
          this._pending = "arin";
          return ARIN.offer;
        }
        return ARIN.idle;
      }
      return [];
    },

    openDialog(npc) {
      this._pending = null;
      const lines = this.linesFor(npc);
      this._who = npc;
      this._lines = lines.length ? lines : ["..."];
      this._i = 0;
      this.dialog = { name: npc.name, line: this._lines[0], last: this._lines.length === 1, id: npc.id };
      this.focus = { x: npc.x, z: npc.z };
      this.craftOpen = false;
      audio.sfx("click");
      if (typeof document !== "undefined" && document.pointerLockElement) document.exitPointerLock();
    },

    advanceDialog() {
      if (!this.dialog) return;
      this._i += 1;
      if (this._i >= this._lines.length) {
        const who = this._who;
        const pending = this._pending;
        this.dialog = null;
        this.focus = null;
        this._pending = null;
        if (who && who.id === "tamo" && this.quest === "talk") {
          this.axe = true;
          this.setQuest("chop");
          this.unlock("axe");
          this.toast = "Kapak Tamo diterima";
        }
        if (who && who.id === "tamo" && (this.quest === "boat" || this.quest === "sail") && !this.built.boat) {
          this.startCutscene("gift");
        }
        if (pending === "arin" && !this.traded.arin && this.inv.stone >= 2) {
          this.inv.stone -= 2;
          this.inv.plank += 2;
          this.repaired = true;
          this.traded.arin = true;
          this.toast = "Altar diperbaiki · +2 papan";
        }
        if (pending === "tamo" && !this.traded.tamo && this.inv.shell >= NEED.shell) {
          this.inv.shell -= NEED.shell;
          this.inv.plank += 2;
          this.traded.tamo = true;
          this.toast = "Kerang ditukar · +2 papan";
        }
        this.advanceGather();
        return;
      }
      this.dialog = {
        name: this._who.name,
        line: this._lines[this._i],
        last: this._i === this._lines.length - 1,
        id: this._who.id,
      };
    },

    dialogProgress() {
      if (!this.dialog) return { i: 0, n: 0 };
      return { i: this._i + 1, n: this._lines.length };
    },

    // ---------- chopping ----------
    startChop(tree) {
      if (this.chop) return;
      this.chop = { tree, t: 0, dur: 0.6, hit: false };
      audio.sfx("chop");
    },

    updateChop(dt) {
      if (!this.chop) return;
      const c = this.chop;
      c.t += dt;
      if (!c.hit && c.t >= 0.25) {
        c.hit = true;
        const tr = c.tree;
        tr.hp -= 1;
        tr.shake = 0.16;
        audio.sfx("chop");
        if (tr.hp <= 0) {
          tr.felled = true;
          tr.falling = true;
          tr.fallT = 0;
          tr.fallDir = Math.sign(Math.sin(this.yaw)) || 1;
          tr.regrowDay = this.day + 2;
          tr.solid.r = 0;
          if (world.invalidateHash) world.invalidateHash();
          this.inv.log += 1;
          this._chopped += 1;
          audio.sfx("fall");
          this.toast = `+1 Kayu  ·  ${this.inv.log}/${NEED.log}`;
          if (this.inv.log >= NEED.log) this.unlock("wood");
          if (world.setNav && world.nav) world.nav.updateAround(tr.x, tr.z, 3);
          this.advanceGather();
        }
      }
      if (c.t >= c.dur) this.chop = null;
    },

    // ---------- house ----------
    placeLog() {
      if (this.quest !== "house") return;
      if (this.houseStage >= HOUSE_NEED) return;
      if (this.inv.log <= 0) {
        this.toast = "Kayu habis. Tebang pohon lagi.";
        return;
      }
      this.inv.log -= 1;
      this.houseQueue.push(1);
      audio.sfx("build");
    },

    updateHouse(dt) {
      if (this.houseAnim > 0) {
        this.houseAnim = Math.max(0, this.houseAnim - dt);
        return;
      }
      if (!this.houseQueue.length) return;
      this.houseQueue.shift();
      this.houseStage = Math.min(HOUSE_NEED, this.houseStage + 1);
      this.houseAnim = 1.2;
      audio.sfx("build");
      if (world.nav) world.nav.updateAround(world.housePos.x, world.housePos.z, 6);
      if (this.houseStage >= HOUSE_NEED) {
        this.unlock("house");
        this.quest = "sleep";
        this.toast = "Rumah selesai! Tidurlah malam ini.";
      }
    },

    // ---------- sleep ----------
    trySleep() {
      const c = this.clock();
      if (!c.isNight) {
        this.toast = "Belum mengantuk. Tidur bisa mulai malam hari.";
        return false;
      }
      if (this.houseStage < 8) return false;
      this.sleeping = true;
      this.sleepFade = 0;
      this.sleepCard = null;
      audio.sfx("sleep");
      return true;
    },

    updateSleep(dt) {
      if (!this.sleeping) return;
      if (!this.sleepCard) {
        // fade to black, then roll the day
        this.sleepFade = Math.min(1, this.sleepFade + dt * 1.6);
        if (this.sleepFade >= 1) {
          this.sleepCard = { day: this.day, log: this._chopped, stage: this.houseStage, cats: this.catsPet };
          this.day += 1;
          this.hour = 6;
          this.unlock("sleep");
          audio.sfx("win");
          this.sleepHold = 2.2;
        }
        return;
      }
      // hold the summary card, then fade back in
      this.sleepHold = (this.sleepHold ?? 0) - dt;
      if (this.sleepHold > 0) return;
      this.sleepFade = Math.max(0, this.sleepFade - dt * 0.9);
      if (this.sleepFade <= 0) {
        this.sleeping = false;
        this.sleepCard = null;
        this.sleepHold = 0;
        this.x = world.housePos.x;
        this.z = world.housePos.z + world.house.d / 2 + 0.9;
        this.toast = `Hari ${this.day} · 06:00 Pagi`;
        if (this.quest === "sleep") this.quest = "boat";
      }
    },

    // ---------- interactions ----------
    interact() {
      const t = this.target();
      if (!t) return;
      if (t.kind === "npc") return this.openDialog(t.ref);
      if (t.kind === "cat") {
        t.ref.purr = 0.5;
        this.catsPet += 1;
        this.unlock("cat");
        this.toast = `${t.ref.name} mendengkur`;
        audio.sfx("meow");
        return;
      }
      if (t.kind === "plot") return this.placeLog();
      if (t.kind === "bed") {
        this.trySleep();
        return;
      }
      if (t.kind === "boat") {
        if (this.quest === "boat") {
          const tamo = world.npcs.find((n) => n.id === "tamo");
          return this.openDialog(tamo);
        }
        this.startCutscene("gift");
        return;
      }
      if (t.kind === "tree") {
        if (!this.axe) {
          this.toast = "Bicara ke Tamo dulu";
          return;
        }
        this.startChop(t.ref);
        return;
      }
      if (t.kind === "rock") {
        t.ref.mined = true;
        t.ref.solid.r = 0;
        if (world.invalidateHash) world.invalidateHash();
        this.inv.stone += 1;
        this.toast = `Batu ${this.inv.stone}/${NEED.stone}`;
        audio.sfx("pickup");
        return;
      }
      if (t.kind === "sand") {
        t.ref.taken = true;
        this.inv.sand += 1;
        this.toast = `Pasir ${this.inv.sand}/${NEED.sand}`;
        audio.sfx("pickup");
        return;
      }
      if (t.kind === "shell") {
        t.ref.taken = true;
        this.inv.shell += 1;
        this.toast = `Kerang ${this.inv.shell}/${NEED.shell}`;
        audio.sfx("pickup");
      }
    },

    // ---------- crafting (menu C) ----------
    recipes() {
      return [
        { id: "plank", name: "Papan", icon: "🪚", cost: { log: 1 }, gives: { plank: 2 }, desc: "1 kayu → 2 papan", tab: "Rumah", forQuest: false },
        { id: "furnace", name: "Tungku", icon: "🔥", cost: { stone: 4, sand: 4 }, gives: {}, desc: "4 batu + 4 pasir", tab: "Perabot", forQuest: false },
        { id: "bed", name: "Kasur", icon: "🛏️", cost: { plank: 2 }, gives: {}, desc: "2 papan", tab: "Perabot", forQuest: false },
        { id: "lantern", name: "Lentera", icon: "🏮", cost: { stone: 1, plank: 1 }, gives: {}, desc: "1 batu + 1 papan", tab: "Perabot", forQuest: false },
      ];
    },

    canCraft(id) {
      const r = this.recipes().find((x) => x.id === id);
      if (!r) return false;
      if (this.ended) return false;
      for (const [k, v] of Object.entries(r.cost)) if ((this.inv[k] || 0) < v) return false;
      return true;
    },

    missingFor(id) {
      const r = this.recipes().find((x) => x.id === id);
      if (!r) return "";
      const names = { log: "kayu", plank: "papan", sand: "pasir", stone: "batu", shell: "kerang" };
      const out = [];
      for (const [k, v] of Object.entries(r.cost)) {
        const have = this.inv[k] || 0;
        if (have < v) out.push(`Butuh ${v - have} ${names[k]} lagi`);
      }
      return out.join(", ");
    },

    craft(id) {
      if (!this.canCraft(id)) {
        this.toast = this.missingFor(id) || "Bahan belum cukup";
        return false;
      }
      const r = this.recipes().find((x) => x.id === id);
      for (const [k, v] of Object.entries(r.cost)) this.inv[k] -= v;
      for (const [k, v] of Object.entries(r.gives)) this.inv[k] += v;
      if (id === "furnace") this.built.furnace = true;
      if (id === "plank") this.toast = `Papan ${this.inv.plank}`;
      else this.toast = `${r.name} dibuat`;
      audio.sfx("build");
      return true;
    },

    // ---------- cutscenes ----------
    startCutscene(kind) {
      this.cut = { kind, t: 0, dur: kind === "gift" ? 15 : kind === "shark" ? 12 : 10, skipped: false };
      this.phase = "cut1";
      this.craftOpen = false;
      if (document.pointerLockElement) document.exitPointerLock();
      audio.sfx("open");
      if (kind === "gift") {
        this.built.boat = true;
        this.unlock("boat");
      }
    },

    updateCutscene(dt) {
      if (!this.cut) return;
      this.cut.t += dt;
      if (this.cut.t >= this.cut.dur || this.cut.skipped) {
        const kind = this.cut.kind;
        this.cut = null;
        if (kind === "gift") {
          this.phase = "card";
          this.quest = "sail";
        }
      }
    },

    beginSail() {
      this.phase = "sail";
      this.sailT = 0;
      this.voyageDist = 0;
      this.quest = "sail";
      this.x = 0;
      this.z = 0;
      this.y = 0.9;
      this.yaw = Math.PI;
      this.ended = false;
      audio.sfx("splash");
    },

    updateSail(dt, keys) {
      this.sailT += dt;
      this.voyageDist += dt * 2.6;
      let turn = 0;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) turn += 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) turn -= 1;
      this.boatBank += (turn * 0.5 - this.boatBank) * Math.min(1, dt * 3);
      this.x = Math.sin(this.sailT * 0.6) * 0.15;
      this.y = 0.9 + Math.sin(this.sailT * 1.3) * 0.05;
      if (this.sailT > 34) {
        this.phase = "shark";
        this.sharkT = 0;
        this.quest = "patch";
        audio.sfx("shark");
      }
    },

    updateShark(dt) {
      this.sharkT = (this.sharkT || 0) + dt;
      if (this.sharkT > 11.5) {
        this.phase = "patch";
        this.patchHold = 0;
        this.toast = "Dua lubang di lambung. Tahan E.";
      }
    },

    updatePatch(dt) {
      const done = this.patches.filter(Boolean).length;
      if (done >= 2) return;
      this.waterLevel = Math.min(0.55, this.waterLevel + dt * 0.012);
      if (this.holdE) {
        this.patchHold = Math.min(1.2, this.patchHold + dt);
        if (this.patchHold >= 1.2) {
          const idx = this.patches.findIndex((p) => !p);
          if (idx >= 0) {
            this.patches[idx] = true;
            audio.sfx("build");
            // one spare log per hole; the deck crate covers a shortfall so the
            // stage can never dead-end
            if (this.inv.log > 0) this.inv.log -= 1;
            else this.sparePlanks = (this.sparePlanks || 0) + 1;
            const left = this.patches.filter(Boolean).length;
            this.toast = `Lubang ${left}/2 ditambal`;
            if (left >= 2) {
              this.waterLevel = 0;
              this.unlock("shark");
              audio.sfx("win");
              this.toast = "Kapal kering. Kota di depan.";
              setTimeout(() => {
                if (this.phase === "patch") this.startCity();
              }, 2400);
            }
          }
          this.patchHold = 0;
        }
      } else {
        this.patchHold = Math.max(0, this.patchHold - dt * 2);
      }
    },

    startCity() {
      this.phase = "city";
      this.cut = { kind: "city", t: 0, dur: 10, skipped: false };
      this.quest = "city";
      world.buildCity();
      audio.sfx("open");
    },

    updateCity(dt) {
      if (!this.cut) {
        this.finishCity();
        return;
      }
      this.cut.t += dt;
      if (this.cut.t >= this.cut.dur || this.cut.skipped) {
        this.cut = null;
        this.finishCity();
      }
    },

    finishCity() {
      if (this.phase === "ending") return;
      this.phase = "ending";
      this.ended = true;
      this.quest = "done";
      this.unlock("city");
      this.unlock("sailor");
      world.disposeCity();
      audio.sfx("win");
      if (document.pointerLockElement) document.exitPointerLock();
    },

    // ---------- physics ----------
    // Soft push-out if something spawned on top of the player (a new tree, a
    // house stage). Slides along walls instead of stopping dead.
    depenetrate(dt) {
      if (!this.blocked(this.x, this.z, 0.28)) return;
      let bx = 0;
      let bz = 0;
      let best = 1e9;
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        const px = this.x + Math.cos(ang) * 0.7;
        const pz = this.z + Math.sin(ang) * 0.7;
        if (this.blocked(px, pz, 0.28)) continue;
        const d = Math.hypot(px - this.x, pz - this.z);
        if (d < best) { best = d; bx = px; bz = pz; }
      }
      if (best === 1e9) return;
      const k = Math.min(1, dt * 6);
      this.x += (bx - this.x) * k;
      this.z += (bz - this.z) * k;
    },

    blocked(x, z, radius = 0.32) {
      if (!onDock(x, z) && surfaceAt(x, z) < 0.12) return true;
      if (world.collides && world.collides(x, z, radius)) return true;
      // steep slopes act as walls
      const h = surfaceAt(x, z);
      const hx = surfaceAt(x + 0.35, z);
      const hz = surfaceAt(x, z + 0.35);
      if (Math.abs(hx - h) > 0.42 || Math.abs(hz - h) > 0.42) return true;
      return false;
    },

    skipTime() {
      this.advanceClock(3);
      this.toast = this.clock().phase;
    },

    advanceClock(hours) {
      const next = this.hour + hours;
      if (next >= 24) this.day += Math.floor(next / 24);
      this.hour = next % 24;
    },

    step(dt, keys) {
      if (this.ended) return;
      if (this.sleeping) {
        this.updateSleep(dt);
        return;
      }
      if (this.phase === "cut1" || this.phase === "city") {
        this.updateCutscene(dt);
        if (this.phase === "city") this.updateCity(dt);
        return;
      }
      if (this.phase === "sail") {
        this.advanceClock((dt / DAY_LEN) * 24 * 3);
        this.updateSail(dt, keys);
        return;
      }
      if (this.phase === "shark") {
        this.advanceClock((dt / DAY_LEN) * 24 * 3);
        this.updateShark(dt);
        return;
      }
      if (this.phase === "patch") {
        this.advanceClock((dt / DAY_LEN) * 24 * 3);
        this.updatePatch(dt);
        return;
      }
      if (this.phase === "card") return;

      this.advanceClock((dt / DAY_LEN) * 24);
      this.updateHouse(dt);
      this.updateChop(dt);
      if (this.holdE && !this.chop) {
        const t = this.target();
        if (t && t.kind === "tree") this.startChop(t.ref);
      }

      if (this.dialog || this.craftOpen || this.paused) {
        this.moving = false;
        return;
      }
      let ix = 0;
      let iz = 0;
      if (keys.has("KeyW") || keys.has("ArrowUp")) iz += 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) iz -= 1;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) ix -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) ix += 1;
      this.moving = (ix !== 0 || iz !== 0) && !this.chop;
      if (!this.moving) return;
      const len = Math.hypot(ix, iz) || 1;
      const sy = Math.sin(this.yaw);
      const cy = Math.cos(this.yaw);
      // forward = (sin,cos); screen-right = (-cos,sin)
      const vx = ((iz / len) * sy - (ix / len) * cy) * SPEED;
      const vz = ((iz / len) * cy + (ix / len) * sy) * SPEED;
      const nx = this.x + vx * dt;
      const nz = this.z + vz * dt;
      if (!this.blocked(nx, this.z)) this.x = nx;
      if (!this.blocked(this.x, nz)) this.z = nz;
      this.walk += dt;
      this.depenetrate(dt);
    },
  };
  return sim;
}
