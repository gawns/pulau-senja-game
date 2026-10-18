# PLAN — Pulau Senja revisi v2

Spesifikasi: paste revisi v2. Dieksekusi bertahap. Setiap fase lolos cek sendiri sebelum lanjut.

Stack: Three.js + Vite. File: `src/world.js` (dunia), `src/sim.js` (aturan), `src/content.js` (teks/quest), `src/main.js` (loop/input/HUD), `src/style.css` + `index.html` (UI).

## Sudah ada (jangan rusak)

PCFSoftShadowMap, HemisphereLight, fog, ACES belum (tambah), warna langit per jam, vertex color tanah, busa pantai, goyangan palem/semak, burung, awan. WASD sudah benar (D = screen-right = world −x). Walkthrough `node walkthrough.mjs` ALL PASS sebelum revisi ini.

## Keputusan yang mengubah kode lama

| Lama | Baru |
|---|---|
| Model kaki+tangan | Kapsul 0.6x, mata, tanpa kaki/tangan. Tamo topi jerami. Mira hilang dari pulau. |
| NEED.log = 6, rumah = 8 papan via menu C | Tebang **10 kayu**. Rumah **8 kayu** ditaruh di tapak (E), 2 sisa untuk tambal. |
| Rumah muncul instan | 8 tahap animasi, antrian kalau E cepat. |
| Tidur tidak ada. T lompat 3 jam | Tidur hanya 19:00–05:00 di kasur. Kartu hari. Bangun 06:00 hari+1. |
| Kapal dari dialog, lalu ending | Cutscene 1 hadiah → kartu 2 tombol → berlayar → hiu → tambal → kota → Tamat. |
| UI kotak keras | Token senja, chip, font Baloo 2 + Nunito. |

## Fase

### 0 Audit
Selesai. Peta file di atas.

### 1 Hidupkan dunia
- [ ] `renderer.toneMapping = ACESFilmicToneMapping`, exposure ~1.05
- [ ] Fog start lebih dekat (sudah 42/130 — turunkan ke ~28/90 supaya horizon hilang)
- [ ] Air: vertex gelombang kecil (delta time), warna dangkal vs dalam via vertex color
- [ ] Palem/rumput/semak: fase acak sudah sebagian; pastikan tidak serempak
- [ ] Kamera: damping sudah ada; tambah lead tipis ke arah gerak
**Terima:** diam 2 detik, posisi mahkota palem berubah. Build 0 error.

### 2 Kapsul + tabrakan
- [ ] Ganti `doodle` → kapsul (badan, mata, kelopak, bayangan blob). Skala 0.6. Hapus kaki/tangan.
- [ ] Animasi: napas, hop+squash jalan, slerp belok, overshoot berhenti
- [ ] Tamo + Arin jalan ke titik kerja, pulang malam. Mira dihapus dari spawn (teks Mira tetap tidak dipanggil)
- [ ] Slide dinding (sudah axis-separate). Depenetration kalau overlap
- [ ] NPC A* grid 0.5, update saat pohon tumbang / rumah tahap
**Terima:** walkthrough gerak D/A tetap PASS. Posisi pemain tidak pernah `blocked`.

### 3 Tebang
- [ ] 3 pukulan, hit-stop, pohon tumbang menjauhi pemain, +1 kayu, tunggul, tumbuh 2 hari
- [ ] NEED.log = 10. Minimal 12 pohon (sekarang 14)
**Terima:** 10 tebang → quest rumah. Pohon ke-11 tidak wajib.

### 4 Rumah + tidur
- [ ] Tapak di `housePos`. E taruh 1 kayu kalau `inv.log>0` dan tahap < 8
- [ ] 8 tahap visual (grup mesh per tahap, scale spring)
- [ ] 8/8 → cutscene pendek → `built.boat = true` belum; kartu dulu di fase 9
- [ ] Kasur: E tidur hanya jika jam malam. `day+1`, `hour=6`, progress quest utuh
**Terima:** log 10 → taruh 8 → log 2. Tidur siang ditolak. Tidur malam hari+1.

### 5 Kucing
- [ ] Soto, Bella, Cemong. State duduk/jalan/main/usap/tidur
- [ ] E usap. Tidak tembus solid
**Terima:** 3 kucing di `world.cats`. Usap naik counter.

### 6–7 HUD + menu C
- [ ] Token warna, chip resource, quest bar, sisi Arin/Tamo
- [ ] Menu C: resep yang ada (papan, tungku) tetap. **Tidak ada perahu.** Dunia jalan, gerak kunci
**Terima:** tidak ada `[data-craft=boat]`. Kontras teks.

### 8 Audio
- [ ] WebAudio: ombak, musik pentatonik, SFX tebang/meong/klik. Mulai setelah input pertama. M mute
**Terima:** `audio.started` false sebelum input; true setelah.

### 9–11 Laut
- [ ] Cutscene 1, kartu Mulai lagi / Lanjut menjelajah
- [ ] Berlayar A/D, hiu, 2 lubang tambal (E tahan), peti cadangan, tidak game over
- [ ] Kota instan lalu dibuang. Kartu Tamat + Mulai lagi
- [ ] `?act=` untuk lompat bab
**Terima:** skip cutscene tidak meninggalkan state salah. Kota `null` setelah selesai.

## Verifikasi berdiri

`npm run build` → 0. `node walkthrough.mjs` → ALL PASS (quest lama tetap sampai rumah/kapal diadaptasi). Screenshot siang.

## Catatan eksekusi

Revisi ini besar. Fase 1–4 dulu supaya pulau main tetap bisa dimainkan. Fase 5–11 menyusul di commit yang sama hanya jika fase sebelumnya hijau.
