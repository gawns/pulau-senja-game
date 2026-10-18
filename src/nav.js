// Grid navigasi + A* untuk NPC dan kucing.
// Grid dibangun dari fungsi blocked() milik sim, jadi selalu sama dengan collider.
export const CELL = 0.5;
export const MIN = -22;
export const MAX = 22;
export const N = Math.round((MAX - MIN) / CELL) + 1;

export function createNav(blocked, radius = 0.28) {
  const grid = new Uint8Array(N * N);
  const idx = (i, j) => j * N + i;
  const toCell = (v) => Math.max(0, Math.min(N - 1, Math.round((v - MIN) / CELL)));
  const toWorld = (i) => MIN + i * CELL;

  function sample(i, j) {
    if (i < 0 || j < 0 || i >= N || j >= N) return true;
    return blocked(toWorld(i), toWorld(j), radius);
  }

  function rebuild() {
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) grid[idx(i, j)] = sample(i, j) ? 1 : 0;
    }
  }

  function updateAround(x, z, r = 3) {
    const ci = toCell(x);
    const cj = toCell(z);
    for (let j = cj - r; j <= cj + r; j++) {
      for (let i = ci - r; i <= ci + r; i++) {
        if (i < 0 || j < 0 || i >= N || j >= N) continue;
        grid[idx(i, j)] = sample(i, j) ? 1 : 0;
      }
    }
  }

  const free = (i, j) => i >= 0 && j >= 0 && i < N && j < N && grid[idx(i, j)] === 0;

  function nearestFree(i, j, maxR = 6) {
    if (free(i, j)) return [i, j];
    for (let r = 1; r <= maxR; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          if (free(i + di, j + dj)) return [i + di, j + dj];
        }
      }
    }
    return null;
  }

  function lineFree(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(d / (CELL * 0.6));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      if (blocked(x, z, radius)) return false;
    }
    return true;
  }

  // A* 8 arah, tanpa memotong sudut, lalu dihaluskan dengan line-of-sight.
  function path(fx, fz, tx, tz, maxNodes = 6000) {
    let si = toCell(fx), sj = toCell(fz);
    let ti = toCell(tx), tj = toCell(tz);
    const s = nearestFree(si, sj);
    const g = nearestFree(ti, tj);
    if (!s || !g) return null;
    [si, sj] = s;
    [ti, tj] = g;
    if (si === ti && sj === tj) return [{ x: tx, z: tz }];

    const open = [[si, sj]];
    const came = new Map();
    const gs = new Map([[idx(si, sj), 0]]);
    const fs = new Map([[idx(si, sj), Math.hypot(ti - si, tj - sj)]]);
    const seen = new Set();
    let nodes = 0;
    let found = false;
    while (open.length && nodes++ < maxNodes) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) {
        if ((fs.get(idx(open[k][0], open[k][1])) ?? 1e9) < (fs.get(idx(open[bi][0], open[bi][1])) ?? 1e9)) bi = k;
      }
      const [ci, cj] = open.splice(bi, 1)[0];
      seen.add(idx(ci, cj));
      if (ci === ti && cj === tj) { found = true; break; }
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di, nj = cj + dj;
          if (!free(ni, nj)) continue;
          if (di && dj && (!free(ci + di, cj) || !free(ci, cj + dj))) continue;
          const k = idx(ni, nj);
          if (seen.has(k)) continue;
          const step = di && dj ? 1.4142 : 1;
          const ng = (gs.get(idx(ci, cj)) ?? 1e9) + step;
          if (ng >= (gs.get(k) ?? 1e9)) continue;
          came.set(k, idx(ci, cj));
          gs.set(k, ng);
          fs.set(k, ng + Math.hypot(ti - ni, tj - nj));
          if (!open.some(([oi, oj]) => idx(oi, oj) === k)) open.push([ni, nj]);
        }
      }
    }
    if (!found) return null;
    const cells = [];
    let cur = idx(ti, tj);
    while (cur !== idx(si, sj)) {
      const j = Math.floor(cur / N);
      const i = cur - j * N;
      cells.push({ x: toWorld(i), z: toWorld(j) });
      const p = came.get(cur);
      if (p == null) break;
      cur = p;
    }
    cells.reverse();
    cells.push({ x: tx, z: tz });
    // smoothing
    const out = [];
    let ax = fx, az = fz;
    let k = 0;
    while (k < cells.length) {
      let far = k;
      for (let m = cells.length - 1; m > k; m--) {
        if (lineFree(ax, az, cells[m].x, cells[m].z)) { far = m; break; }
      }
      out.push(cells[far]);
      ax = cells[far].x;
      az = cells[far].z;
      k = far + 1;
    }
    return out;
  }

  rebuild();
  return { grid, N, CELL, MIN, rebuild, updateAround, free, path, toCell, toWorld, lineFree };
}
