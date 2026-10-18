import { ACHIEVEMENTS, ARIN, MIRA, NEED, ORDER, QUESTS, TAMO } from "./content.js";
import { onDock, surfaceAt } from "./world.js";

const TALK = 2.4;
const REACH = 1.9;
const SPEED = 4.6;
const DAY_LEN = 480; // detik per 24 jam

export function createSim(world) {
  const sim = {
    x: 0,
    z: -14.2,
    yaw: 0,
    pitch: -0.1,
    walk: 0,
    moving: false,
    started: false,
    paused: false,
    lookLocked: false,
    craftOpen: false,
    ended: false,
    sailing: 0,
    axe: false,
    repaired: false,
    quest: "talk",
    hour: 8.2,
    day: 1,
    dialog: null,
    focus: null,
    toast: null,
    inv: { log: 0, plank: 0, sand: 0, stone: 0, shell: 0 },
    built: { furnace: false, house: false, boat: false },
    traded: { arin: false, tamo: false },
    ach: [],
    achQueue: [],
    _who: null,
    _lines: null,
    _i: 0,
    _pending: null,

    // ---------- quest ----------
    questView() {
      const q = QUESTS[this.quest] || QUESTS.done;
      const total = ORDER.length - 1;
      const step = Math.min(total, Math.max(0, ORDER.indexOf(this.quest)));
      const need = q.count ? NEED[q.count] : 0;
      const have = q.count ? this.inv[q.count] : 0;
      const pct = q.count ? Math.min(1, have / need) : step / total;
      return {
        kicker: this.quest === "done" ? "Selesai" : `Langkah ${step + 1} / ${total}`,
        title: q.title,
        detail: q.count ? `${q.detail}  ${have}/${need}` : q.detail,
        pct,
        showBar: step > 0 && this.quest !== "done",
      };
    },

    sideView() {
      const out = [];
      if (!this.traded.arin) out.push(`Arin: altar ${Math.min(this.inv.stone, 2)}/2 batu`);
      if (!this.traded.tamo) out.push(`Tamo: kerang ${Math.min(this.inv.shell, NEED.shell)}/${NEED.shell}`);
      return out.join("   ·   ");
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
      return { text: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, phase, night: world.night > 0.5 };
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
      const cands = [];
      const push = (kind, list, reach, ok, label, bias = 0) => {
        const it = this.nearest(list, reach, ok);
        if (!it) return;
        const d = Math.hypot(it.x - this.x, it.z - this.z) + bias;
        cands.push({ kind, ref: it, d, label: typeof label === "function" ? label(it) : label });
      };
      push("npc", world.npcs, TALK, null, (n) => `E  bicara ${n.name}`, -1.4);
      if (this.built.boat && this.quest === "sail") push("boat", [world.boat], 2.8, null, "E  berlayar");
      push("tree", world.trees, REACH, (t) => !t.felled, () => (this.axe ? "E  tebang pohon" : "Butuh kapak dari Tamo"));
      push("rock", world.rocks, REACH, (r) => !r.mined, "E  ambil batu");
      push("sand", world.sands, REACH, (s) => !s.taken, "E  ambil pasir");
      push("shell", world.shells, REACH, (s) => !s.taken, "E  ambil kerang");
      if (!cands.length) return null;
      cands.sort((a, b) => a.d - b.d);
      return cands[0];
    },

    promptText() {
      if (!this.started || this.dialog || this.ended || this.paused) return "";
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
      if (this.quest === "chop" && this.inv.log >= NEED.log) this.setQuest("planks");
      else if (this.quest === "planks" && this.inv.plank >= NEED.plank) this.setQuest("sand");
      else if (this.quest === "sand" && this.inv.sand >= NEED.sand) this.setQuest("stone");
      else if (this.quest === "stone" && this.inv.stone >= NEED.stone) this.setQuest("furnace");
    },

    linesFor(npc) {
      const q = this.quest;
      if (npc.id === "tamo") {
        if (q === "talk") return TAMO.talk;
        if (q === "boat") return TAMO.boat;
        if (q === "sail" || q === "done") return TAMO.sail;
        if (this.traded.tamo) return TAMO.after;
        if (this.inv.shell >= NEED.shell) {
          this._pending = "tamo";
          return TAMO.offer;
        }
        return TAMO[q] || TAMO.idle;
      }
      if (npc.id === "mira") {
        if (this.traded.mira || this.inv.log >= 2) {
          this._pending = "mira";
          return MIRA.offer;
        }
        return MIRA[q] || MIRA.idle;
      }
      if (npc.id === "arin") {
        if (this.traded.arin) return ARIN.after;
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
        if (who && who.id === "tamo" && this.quest === "boat") {
          this.built.boat = true;
          this.setQuest("sail");
          this.unlock("boat");
          this.toast = "Kapal Tamo terbuka";
        }
        if (pending === "arin" && !this.traded.arin && this.inv.stone >= 2) {
          this.inv.stone -= 2;
          this.inv.plank += 2;
          this.repaired = true;
          this.traded.arin = true;
          this.unlock("arin");
          this.toast = "Altar diperbaiki · +2 papan";
        }
        if (pending === "tamo" && !this.traded.tamo && this.inv.shell >= NEED.shell) {
          this.inv.shell -= NEED.shell;
          this.inv.plank += 2;
          this.traded.tamo = true;
          this.toast = "Kerang ditukar · +2 papan";
        }
        if (pending === "mira" && !this.traded.mira && this.inv.log >= 2) {
          this.inv.log -= 2;
          this.inv.plank += 4;
          this.traded.mira = true;
          this.toast = "Mira membelah kayu · +4 papan";
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

    interact() {
      const t = this.target();
      if (!t) return;
      if (t.kind === "npc") return this.openDialog(t.ref);
      if (t.kind === "boat") {
        this.ended = true;
        this.quest = "done";
        this.sailing = 0.001;
        this.unlock("sailor");
        this.toast = "Kapal meninggalkan pulau";
        if (document.pointerLockElement) document.exitPointerLock();
        return;
      }
      if (t.kind === "tree") {
        if (!this.axe) {
          this.toast = "Bicara ke Tamo dulu";
          return;
        }
        t.ref.felled = true;
        t.ref.solid.r = 0;
        this.inv.log += 1;
        this.toast = `Kayu ${this.inv.log}/${NEED.log}`;
        if (this.inv.log >= NEED.log) this.unlock("wood");
        this.advanceGather();
        return;
      }
      if (t.kind === "rock") {
        t.ref.mined = true;
        t.ref.solid.r = 0;
        this.inv.stone += 1;
        this.toast = `Batu ${this.inv.stone}/${NEED.stone}`;
        if (this.inv.stone >= NEED.stone) this.unlock("stone");
        this.advanceGather();
        return;
      }
      if (t.kind === "sand") {
        t.ref.taken = true;
        this.inv.sand += 1;
        this.toast = `Pasir ${this.inv.sand}/${NEED.sand}`;
        if (this.inv.sand >= NEED.sand) this.unlock("sand");
        this.advanceGather();
        return;
      }
      if (t.kind === "shell") {
        t.ref.taken = true;
        this.inv.shell += 1;
        this.toast = `Kerang ${this.inv.shell}/${NEED.shell}`;
      }
    },

    canCraft(id) {
      const q = this.quest;
      if (q === "done") return false;
      if (id === "plank") return this.stage() >= ORDER.indexOf("planks") && this.inv.log >= 1;
      if (id === "furnace") return q === "furnace" && this.inv.stone >= NEED.stone && this.inv.sand >= NEED.sand;
      if (id === "house") return q === "house" && this.inv.plank >= NEED.plank;
      return false;
    },

    craft(id) {
      if (!this.canCraft(id)) {
        this.toast = "Bahan atau misi belum cukup";
        return false;
      }
      if (id === "plank") {
        this.inv.log -= 1;
        this.inv.plank += 2;
        this.toast = `Papan ${this.inv.plank}/${NEED.plank}`;
        if (this.inv.plank >= NEED.plank) this.unlock("plank");
        this.advanceGather();
      } else if (id === "furnace") {
        this.inv.stone -= NEED.stone;
        this.inv.sand -= NEED.sand;
        this.built.furnace = true;
        this.unlock("furnace");
        this.setQuest("house");
      } else if (id === "house") {
        this.inv.plank -= NEED.plank;
        this.built.house = true;
        this.unlock("house");
        this.setQuest("boat");
      }
      return true;
    },

    // ---------- physics ----------
    blocked(x, z) {
      if (!onDock(x, z) && surfaceAt(x, z) < 0.12) return true; // waterline only, jetty excepted
      for (const s of world.solids) {
        if (s.r <= 0) continue;
        if (Math.hypot(s.x - x, s.z - z) < s.r + 0.32) return true;
      }
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
      if (this.ended) {
        this.sailing = Math.min(1, this.sailing + dt * 0.32);
        return;
      }
      this.advanceClock((dt / DAY_LEN) * 24);

      if (this.dialog || this.craftOpen || this.paused) {
        this.moving = false;
        return;
      }
      let ix = 0;
      let iz = 0;
      if (keys.has("KeyW")) iz += 1;
      if (keys.has("KeyS")) iz -= 1;
      if (keys.has("KeyA")) ix -= 1;
      if (keys.has("KeyD")) ix += 1;
      this.moving = ix !== 0 || iz !== 0;
      if (!this.moving) return;
      const len = Math.hypot(ix, iz) || 1;
      const sy = Math.sin(this.yaw);
      const cy = Math.cos(this.yaw);
      // forward = (sin,cos); screen-right = (-cos,sin) for a camera looking along +forward
      const vx = ((iz / len) * sy - (ix / len) * cy) * SPEED;
      const vz = ((iz / len) * cy + (ix / len) * sy) * SPEED;
      const nx = this.x + vx * dt;
      const nz = this.z + vz * dt;
      if (!this.blocked(nx, this.z)) this.x = nx;
      if (!this.blocked(this.x, nz)) this.z = nz;
      this.walk += dt;
    },
  };
  return sim;
}
