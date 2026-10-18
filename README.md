# Pulau Senja

Survival pulau kecil di Three.js. Terdampar, bicara ke penghuni, kumpulkan bahan, bangun rumah dan kapal, lalu berlayar.

## Jalankan

```
npm install
npm run dev      # http://localhost:5173
npm run build && npm run preview
```

## Kontrol

| Aksi | Tombol |
|---|---|
| Jalan | WASD |
| Lihat | mouse (klik kanvas untuk kunci pointer) |
| Aksi / bicara / ambil | E |
| Buat (crafting) | C |
| Lewati 3 jam | T |
| Jeda | Esc |
| Lanjut dialog | Enter atau klik "Lanjut" |

Di layar sentuh, tombol D-pad dan E/C/T muncul otomatis; geser di kanvas untuk memutar kamera.

## Alur main

1. **Bicara Mira** — dapat kapak.
2. **Tebang 6 pohon** → 6 kayu.
3. **Buat papan** (C) — 1 kayu jadi 2 papan, butuh 8.
4. **Ambil 4 pasir**.
5. **Ambil 4 batu** (sisakan 2 untuk side quest Arin).
6. **Buat tungku** (4 batu + 4 pasir).
7. **Bangun rumah** (8 papan).
8. **Bangun kapal** (4 papan).
9. **Naik kapal** di pantai utara — ending.

Side quest: Arin minta 2 batu (bayar 2 papan), Tamo minta 3 kerang (bayar 2 papan).

## Siang–malam

Satu hari penuh = 420 detik. Langit, kabut, cahaya matahari, dan lampu lentera diinterpolasi dari keyframe. Malam tetap terlihat: obor jinjing menyala di sekitar pemain dan ambient dinaikkan, jadi pulau tidak jadi hitam pekat. Tekan T untuk mempercepat.

## Verifikasi

```
npm test        # walkthrough.mjs — main pakai keyboard asli, tanpa teleport
npm run audit   # audit.mjs — jangkauan seluruh objek + kecerahan siang/malam
```

`walkthrough.mjs` menjalankan 25 cek: bicara NPC, menebang 6 pohon dengan berjalan, crafting lewat klik UI, side quest, rantai bangunan, ending, jeda, dan rollover hari. Butuh server di `http://localhost:5173` (atau set `SENJA_URL`). Chrome sistem dipakai lewat `puppeteer-core`.

`audit.mjs` memetakan grid tabrakan, BFS dari spawn, lalu memastikan 37 objek interaktif punya sel terjangkau dalam jarak interaksi — plus mengukur kecerahan & kontras layar pada 12h/18.3h/22h/2h.

## Struktur

```
index.html      HUD + panel (dialog, crafting, ending, menu)
src/main.js     bootstrap Three.js, kamera, keybinding, kontrol sentuh
src/sim.js      state, quest, inventory, crafting, target(), waktu
src/world.js    geometri pulau, langit, pohon/batu/pasir, NPC, bangunan
src/content.js  angka kebutuhan, teks quest, dialog NPC
src/style.css   gaya HUD
```
