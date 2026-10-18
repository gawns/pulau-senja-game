// Angka kebutuhan, teks quest, dialog. Semua teks Indonesia.
export const NEED = { log: 10, house: 8, plank: 8, sand: 4, stone: 4, shell: 3, patch: 2 };

export const ORDER = ["talk", "chop", "house", "sleep", "boat", "sail", "patch", "city", "done"];

export const QUESTS = {
  talk: {
    title: "Cari Tamo",
    detail: "Tamo menunggumu dekat api unggun, sisi utara pantai.",
    count: null,
  },
  chop: {
    title: "Tebang pohon",
    detail: "Tebang 10 pohon, 8 kayu untuk rumah Tamo.",
    count: "log",
  },
  house: {
    title: "Bangun rumah Tamo",
    detail: "Bawa kayu ke tapak rumah, tekan E untuk menaruh.",
    count: null,
  },
  sleep: {
    title: "Tidur di rumah baru",
    detail: "Malam hari, dekati kasur dan tekan E untuk tidur.",
    count: null,
  },
  boat: {
    title: "Temui Tamo di dermaga",
    detail: "Rumah berdiri. Tamo menunggumu di dermaga.",
    count: null,
  },
  sail: {
    title: "Berlayar",
    detail: "Perahu Tamo di dermaga. Tekan E untuk berangkat.",
    count: null,
  },
  patch: {
    title: "Tambal kapal",
    detail: "Dua lubang di lambung. Tahan E di tiap lubang.",
    count: null,
  },
  city: {
    title: "Tiba di kota",
    detail: "Kota di depan. Perahu merapat ke dermaga.",
    count: null,
  },
  done: {
    title: "Pulau Senja di belakang",
    detail: "Kau membawa cerita ini ke laut.",
    count: null,
  },
};

export const ACHIEVEMENTS = {
  axe: { icon: "🪓", title: "Kapak Pertama", desc: "Tamo meminjamkan kapaknya." },
  wood: { icon: "🪵", title: "Penebang", desc: "Sepuluh pohon tumbang." },
  house: { icon: "🏠", title: "Rumah Pertama", desc: "Rumah berdiri dari delapan kayu." },
  sleep: { icon: "🌙", title: "Tidur Nyenyak", desc: "Hari baru dimulai." },
  cat: { icon: "🐈", title: "Sahabat Pulau", desc: "Mengusap Soto, Bella, atau Cemong." },
  boat: { icon: "⛵", title: "Kepercayaan Tamo", desc: "Tamo memberikan perahunya." },
  shark: { icon: "🦈", title: "Bertahan", desc: "Hiu menyerang, kapal ditambal." },
  sailor: { icon: "🌅", title: "Berlayar", desc: "Kau meninggalkan Pulau Senja." },
  city: { icon: "🏙️", title: "Kota Baru", desc: "Kau tiba di kota pelabuhan." },
};

export const INTRO = {
  kicker: "Pulau Senja",
  title: "Terdampar",
  lines: [
    "Badai mematahkan tiang kapalmu. Kau ingat air, lalu gelap.",
    "Kau bangun di pasir, di pulau yang tidak ada di peta. Tamo menyeretmu dari karang dan menutup luka di pelipismu dengan daun.",
    "Tamo tinggal di bawah jaring yang sobek. Ia ingin punya rumah sebelum musim hujan, dan ia punya perahu — tapi tidak akan memberikannya pada orang yang tidak tinggal cukup lama untuk membangun sesuatu.",
    "Bangun rumah untuk Tamo. Maka perahu itu jadi milikmu.",
    "WASD bergerak, E berinteraksi, C membuka menu bangun, M membisukan suara. Tidur hanya bisa saat malam.",
  ],
};

export const TAMO = {
  talk: [
    "Kau bangun. Bagus. Aku sudah menggali satu liang untukmu, kalau kau tidak bangun.",
    "Aku Tamo. Pulau ini tidak punya nama di peta, dan aku sudah lama berhenti memberi nama pada hal-hal yang bisa hilang.",
    "Dengarkan. Musim hujan datang dalam beberapa minggu. Aku butuh rumah, bukan jaring sobek.",
    "Tebang sepuluh pohon. Delapan kayu untuk rumahku, dua sisanya simpan untuk kapal.",
    "Ambil kapak ini. Jangan buang, itu satu-satunya yang kumiliki.",
  ],
  chop: [
    "Sepuluh kayu. Pohon di utara gubuk, yang batangnya lurus.",
    "Jangan tebang pohon kelapa di tepi pantai. Itu makananku.",
    "Ayunkan ke pangkal batang, bukan ke tengah. Lebih cepat roboh.",
  ],
  house: [
    "Tapak rumah ada di petak timur, dekat pohon besar.",
    "Bawa kayu ke tapak, tekan E untuk menaruh satu. Aku akan memalu.",
    "Delapan kayu. Dua sisanya jangan disentuh — untuk kapal.",
  ],
  sleep: [
    "Rumah itu berdiri. Malam ini kau bisa tidur di kasur.",
    "Tidur hanya saat malam. Siang hari, matahari masih terlalu tinggi.",
  ],
  boat: [
    "Rumah itu berdiri. Aku tidak menyangka kau bisa.",
    "Dengar. Perahuku di dermaga utara. Layarnya sudah kuperbaiki kemarin.",
    "Bawa ia pergi. Dan kalau kau sampai di pulau berikutnya, ceritakan tentang pulau ini — supaya ia punya nama.",
    "Pergi sekarang, sebelum aku menyesal memberikannya.",
  ],
  sail: ["Perahu itu menunggumu di dermaga.", "Naik, dan jangan menoleh. Selalu maju."],
  done: ["Pergi. Angin tidak menunggu."],
  idle: [
    "Aku menghitung ombak. Sampai dua puluh, lalu lupa dan mulai lagi.",
    "Kerang putih di garis air. Tiga cukup untuk ditukar dua papan.",
    "Pulau ini pernah ramai. Dua belas orang. Sekarang tinggal kami bertiga.",
    "Perahuku sudah tua, tapi masih kuat. Seperti aku.",
  ],
  offer: ["Tiga kerang? Bagus. Aku tukar dua papan.", "Tamo menyimpan kerang di kantongnya. \"Untuk kapalmu nanti.\""],
  after: ["Kerangmu sudah di kantongku. Tenang saja."],
  gift: [
    "Ini dia. Perahu yang kujanjikan.",
    "Terima kasih sudah membangun rumah. Arin, Soto, Bella, Cemong — semua ikut melepasmu.",
    "Pergi. Laut sedang baik hari ini.",
  ],
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
  night: ["Malam. Aku pulang ke rumah.", "Bintang di atas pulau ini terang. Tidurlah."],
};

export const CATS = {
  soto: { name: "Soto", fur: 0xd98b3f, belly: 0xf3d9a8, stripe: 0xa95f24 },
  bella: { name: "Bella", fur: 0x9aa0a6, belly: 0xd9dde0, stripe: 0x6f757a },
  cemong: { name: "Cemong", fur: 0x2e2b2a, belly: 0xf2efe8, stripe: 0x161414 },
};
