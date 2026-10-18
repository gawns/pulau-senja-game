export const NEED = { log: 6, plank: 8, sand: 4, stone: 4, shell: 3 };

export const ORDER = ["talk", "chop", "planks", "sand", "stone", "furnace", "house", "boat", "sail", "done"];

export const QUESTS = {
  talk: { title: "Cari Tamo", detail: "Tamo menunggumu dekat api unggun, sisi utara pantai.", count: null },
  chop: { title: "Tebang pohon", detail: "Enam kayu untuk rangka rumah Tamo.", count: "log" },
  planks: { title: "Belah papan", detail: "Tekan C, belah kayu jadi papan.", count: "plank" },
  sand: { title: "Kumpulkan pasir", detail: "Pasir halus di garis air, sisi selatan.", count: "sand" },
  stone: { title: "Kumpulkan batu", detail: "Batu di punggung timur, dekat kuil Arin.", count: "stone" },
  furnace: { title: "Bangun tungku", detail: "Empat batu, empat pasir. Tekan C.", count: null },
  house: { title: "Bangun rumah Tamo", detail: "Delapan papan. Tekan C di petak timur.", count: "plank" },
  boat: { title: "Bicara ke Tamo", detail: "Rumahnya selesai. Tamo menunggu di dermaga.", count: null },
  sail: { title: "Berlayar", detail: "Kapal Tamo di dermaga. Tekan E untuk berangkat.", count: null },
  done: { title: "Pulau Senja di belakang", detail: "Kau membawa cerita ini ke laut.", count: null },
};

export const ACHIEVEMENTS = {
  axe: { icon: "K", title: "Kapak Pertama", desc: "Tamo meminjamkan kapaknya." },
  wood: { icon: "T", title: "Penebang", desc: "Enam pohon tumbang." },
  plank: { icon: "P", title: "Tukang Kayu", desc: "Delapan papan terbelah." },
  sand: { icon: "S", title: "Penyapu Pantai", desc: "Empat pasir terkumpul." },
  stone: { icon: "B", title: "Pengumpul Batu", desc: "Empat batu di kantong." },
  furnace: { icon: "A", title: "Api Pertama", desc: "Tungku menyala." },
  house: { icon: "R", title: "Atap untuk Tamo", desc: "Rumah berdiri di petak timur." },
  boat: { icon: "K", title: "Kepercayaan Tamo", desc: "Tamo membuka kapalnya." },
  arin: { icon: "U", title: "Altar Pulih", desc: "Kuil Arin kembali utuh." },
  sailor: { icon: "L", title: "Berlayar", desc: "Kau meninggalkan Pulau Senja." },
};

export const INTRO = {
  kicker: "Pulau Senja",
  title: "Terdampar",
  lines: [
    "Badai mematahkan tiang kapalmu. Kau ingat air, lalu gelap.",
    "Kau bangun di pasir, di pulau yang tidak ada di peta. Tamo menyeretmu dari karang dan menutup luka di pelipismu dengan daun.",
    "Tamo tinggal di bawah jaring yang sobek. Ia ingin punya rumah sebelum musim hujan, dan ia punya kapal \u2014 tapi tidak akan memberikannya pada orang yang tidak tinggal cukup lama untuk membangun sesuatu.",
    "Bangun rumah untuk Tamo. Maka kapal itu jadi milikmu.",
    "Gunakan WASD untuk bergerak, E untuk berinteraksi, C untuk membuka meja kerja, T untuk mempercepat waktu.",
  ],
};

export const MIRA = {
  talk: [
    "Kau yang ditemukan Tamo di karang. Kau tidur dua hari.",
    "Aku Mira. Gubuk ini milikku, jaring itu juga. Jangan sentuh.",
    "Tamo sudah menunggumu di api unggun. Pergi sebelum ia mengomel.",
  ],
  chop: [
    "Kapak Tamo masih tajam. Ayunkan ke pangkal, bukan ke tengah batang.",
    "Enam pohon. Jangan tebang yang berbuah, aku butuh kelapanya.",
  ],
  planks: [
    "Belah kayu jadi papan. Tekan C, pilih Papan.",
    "Satu kayu jadi dua papan. Jangan buang serpihannya, aku pakai untuk api.",
  ],
  sand: [
    "Pasir halus ada di garis air selatan, tempat kerang putih.",
    "Ambil yang kering. Pasir basah bikin tungku retak.",
  ],
  stone: [
    "Batu ada di punggung timur, dekat kuil tua Arin.",
    "Arin akan mengangguk kalau kau tidak menyentuh altarnya.",
  ],
  furnace: ["Tungku dulu sebelum rumah. Tanpa api, papan akan melengkung oleh embun."],
  house: ["Rumah Tamo di petak timur. Delapan papan, tekan C."],
  boat: ["Tamo menunggu di dermaga. Ia selalu menunggu di sana sejak istrinya pergi."],
  sail: ["Angin dari barat hari ini. Pergi sekarang, atau tunggu badai berikutnya."],
  done: ["Kau masih di sini? Aku kira kau sudah jauh."],
  idle: [
    "Aku menghitung hari dengan pasang. Sudah tiga ribu tujuh ratus pasang.",
    "Kalau kau mau papan tambahan, bawa dua kayu. Aku punya kapak lain.",
    "Jangan tidur di pasir. Air naik cepat saat bulan penuh.",
    "Ikan terbaik ada di karang timur, saat senja. Tapi kau tidak punya kail.",
    "Tamo dulu pelaut ulung. Sebelum kakinya.",
  ],
  offer: ["Dua kayu? Aku belah jadi papan untukmu. Cepat, sebelum hujan."],
  after: ["Papanmu sudah kering. Simpan baik-baik."],
};

export const ARIN = {
  idle: [
    "Kuil ini tua. Jangan naik ke altar.",
    "Batu longgar bertebaran di timur. Dua cukup untuk menambal yang retak.",
    "Aku tidak pergi dari pulau ini. Seseorang harus menjaga nama yang tertulis di batu.",
    "Pulau ini mengingat semua yang pernah tinggal di sini. Batu-batu ini mencatat.",
    "Senja di sini selalu jingga. Itu kenapa Tamo menamainya Pulau Senja.",
  ],
  offer: ["Altar retak. Dua batu kecil bisa menambalnya.", "Arin menambal altar. Ia menukar dua papan. \"Buat rumahmu, orang asing.\""],
  after: ["Altar utuh lagi. Terima kasih. Kau boleh lewat kapan saja."],
  quest: ["Tamo bercerita tentangmu. Ia tidak mudah percaya pada orang yang datang dari laut."],
};

export const TAMO = {
  talk: [
    "Kau bangun. Bagus. Aku sudah menggali satu liang untukmu, kalau kau tidak bangun.",
    "Aku Tamo. Pulau ini tidak punya nama di peta, dan aku sudah lama berhenti memberi nama pada hal-hal yang bisa hilang.",
    "Dengarkan baik-baik. Musim hujan datang dalam beberapa minggu. Aku butuh rumah, bukan jaring sobek.",
    "Bangun rumahku di petak timur, dekat pohon besar. Kalau rumah itu berdiri sebelum hujan, kapalku jadi milikmu.",
    "Ambil kapak ini. Jangan buang, itu satu-satunya yang kumiliki.",
  ],
  chop: [
    "Enam kayu. Pohon di utara gubuk Mira, yang batangnya lurus.",
    "Jangan tebang pohon kelapa di tepi pantai. Itu makananku.",
    "Ayunkan ke pangkal batang, bukan ke tengah. Lebih cepat roboh.",
  ],
  planks: [
    "Belah kayu jadi papan. Tekan C, pilih Papan.",
    "Satu kayu jadi dua papan. Kita butuh delapan untuk dinding.",
  ],
  sand: [
    "Pasir ada di selatan, tempat kerang putih bertebaran.",
    "Empat genggam pasir, cukup untuk adukan tungku.",
  ],
  stone: [
    "Batu di punggung timur, dekat kuil tua Arin.",
    "Empat butir. Jangan sentuh batu altar, Arin bisa mengusirmu.",
  ],
  furnace: [
    "Tungku dulu sebelum rumah. Tanpa api, papan basah tidak akan kering.",
    "Empat batu, empat pasir. Tekan C lalu pilih Tungku.",
  ],
  house: [
    "Delapan papan. Tekan C. Bangun di petak timur.",
    "Letakkan fondasi dulu, baru dinding. Kau tahu cara membangun, kan?",
  ],
  boat: [
    "Rumah itu berdiri. Aku tidak menyangka kau bisa.",
    "Dengar. Kapalku di dermaga utara. Layarnya sudah kuperbaiki kemarin.",
    "Bawa ia pergi. Dan kalau kau sampai di pulau berikutnya, ceritakan tentang pulau ini — supaya ia punya nama.",
    "Pergi sekarang, sebelum aku menyesal meminjamkannya.",
  ],
  sail: [
    "Kapal itu menunggumu di dermaga.",
    "Naik, dan jangan menoleh. Selalu maju.",
  ],
  done: ["Pergi. Angin tidak menunggu."],
  idle: [
    "Aku menghitung ombak. Sampai dua puluh, lalu lupa dan mulai lagi.",
    "Kerang putih di garis air. Tiga cukup untuk ditukar dua papan.",
    "Mira bilang kau tidak berguna. Aku bilang semua orang berguna kalau diberi kapak.",
    "Pulau ini pernah ramai. Dua belas orang. Sekarang tinggal kami bertiga.",
    "Kapalku sudah tua, tapi masih kuat. Seperti aku.",
  ],
  offer: ["Tiga kerang? Bagus. Aku tukar dua papan.", "Tamo menyimpan kerang di kantongnya. \"Untuk kapalmu nanti.\""],
  after: ["Kerangmu sudah di kantongku. Tenang saja."],
};
