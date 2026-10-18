# Pulau Senja

Survival pulau kecil di Three.js. Terdampar, bicara ke penghuni, bangun rumah Tamo, tidur, lalu berlayar melewati hiu sampai kota.

## Jalankan

```
npm install
npm run dev      # http://localhost:5173
npm run build && npm run preview
```

## Kontrol

| Aksi | Tombol |
|---|---|
| Jalan | WASD / panah |
| Lihat | mouse (klik kanvas untuk kunci pointer) |
| Aksi / bicara / ambil / tidur / usap kucing | E |
| Bangun (menu resep) | C |
| Bisukan suara | M |
| Jeda | Esc |
| Lewati cutscene | tahan Esc |
| Lanjut dialog | Enter atau klik "Lanjut" |
| Tampilkan collider + grid jalur | F3 atau `?debug=collider` |

Di layar sentuh, tombol D-pad dan E/C muncul otomatis; geser di kanvas untuk memutar kamera.

## Alur main

1. **Bicara Tamo** — dapat kapak.
2. **Tebang 10 pohon** — 3 pukulan per pohon, tiap pukulan animasi penuh.
3. **Taruh 8 kayu** di tapak rumah (E). Rumah tumbuh dalam 8 tahap animasi. 2 kayu sisa disimpan.
4. **Tidur** di kasur saat malam (19:00–05:00). Hari +1, bangun 06:00.
5. **Bicara Tamo** di dermaga — Cutscene 1 (hadiah perahu) → kartu **Mulai lagi / Lanjut menjelajah**.
6. **Berlayar** (A/D belok) → Cutscene 2 hiu → **tambal 2 lubang** (tahan E) → Cutscene 3 kota → **Tamat**.

Side quest: Arin minta 2 batu (bayar 2 papan), Tamo minta 3 kerang (bayar 2 papan). Kucing: Soto, Bella, Cemong — tekan E untuk mengusap.

## Dunia

- Kapsul 0.6x tanpa kaki/tangan, napas + kedip + hop + squash.
- NPC dan kucing pakai A* di grid 0.5 yang dibangun dari collider yang sama; grid diperbarui saat pohon tumbang dan rumah dibangun. Deteksi macet 1.5 dtk lalu hitung ulang jalur.
- Rumah punya dinding sendiri dengan celah pintu; atap memudar saat pemain masuk.
- Air bergelombang, palem/rumput bergoyang dengan fase acak, bayangan mengikuti pemain.
- Audio WebAudio sintetis (ombak, angin, musik pentatonik, SFX) — mulai setelah input pertama, M untuk mute.

## Verifikasi

```
npm test        # walkthrough.mjs — alur penuh pakai keyboard asli, tanpa teleport
npm run test:revisi   # revisi-test.mjs — cek fitur v2 + soak NPC/kucing
npm run audit   # audit.mjs — jangkauan objek + kecerahan siang/malam
```

Butuh server di `http://localhost:5173` (atau set `SENJA_URL`). Chrome sistem dipakai lewat `puppeteer-core`.
`walkthrough.mjs` memakai `?lowfx=1` karena software renderer headless tidak sanggup 60 FPS; angka itu hanya untuk QA.

## Struktur

```
index.html        HUD + panel (quest, jam, resource, dialog, menu C, kartu, ending)
src/main.js       bootstrap Three.js, kamera, keybinding, HUD paint, QA ?act=
src/sim.js        state, quest, inventory, tebang, rumah, tidur, cutscene, fisika
src/world.js      geometri pulau, langit, karakter kapsul, kucing, rumah, laut, kota
src/nav.js        grid navigasi + A* + smoothing
src/audio.js      WebAudio: ambient, musik, SFX
src/content.js    angka kebutuhan, teks quest, dialog NPC, data kucing
src/style.css     token senja, panel, chip, menu, responsif
```
