/* =========================================================
   KİŞİSELLEŞTİR — isimler, anı mektupları ve final mesajı
   ========================================================= */
export const NAMES = ['Mete', 'Bahar'];

// Her bölümde saklı bir mektup var; bulunursa bölüm sonunda okunur.
export const LETTERS = [
  'Seninle tanıştığım gün, dünyanın en güzel bahçesine adım atmışım gibi hissettim. 🌸',
  'Farklıyız belki; biri mavi, biri pembe. Ama birlikte her köprüyü geçiyoruz. 💙💗',
  'Ormanda kaybolsak bile, senin sesini duyduğum yer benim evim. 🌲',
  'En soğuk günlerde bile ellerin hep sıcak. Buz dağları bize vız gelir. ❄️',
  'Şehrin bütün ışıkları sönse, gözlerin yeter bana yolumu bulmaya. 🌃',
  'Hayatım seninle şeker gibi; bazen yapış yapış, ama hep tatlı. 🍭',
  'Seninleyken bulutların üstündeyim, ayaklarım yere hiç basmıyor. ☁️',
  'Yıldızlara kadar çıktık; ama en parlak yıldız hep yanımdaydı. ✨',
];

export const FINAL_MSG = 'Sekiz dünya, bir sürü düşüş, bir o kadar kahkaha...<br>Ama her seferinde birbirimizi bekledik. Sonsuza dek birlikte. 💞';

/* =========================================================
   BÖLÜM HARİTALARI
   Koordinatlar: x sağa, y yukarı (y=0 en alt sıra). ground(x0,x1,top) → üstüne basılan yüzey top+1.
   Karakterler: 2 blok zıplar, birinin omzuna çıkınca 3 blok. 4 boşluğa kadar atlanır.

   #  zemin          I  buz (kaygan)      -  tek yönlü platform (alttan geçilir)
   [  mavi blok (sadece 1. oyuncuyu taşır)  ]  pembe blok (sadece 2. oyuncuyu taşır)
   ^  diken          ~  su                o  yay
   1 2 başlangıçlar  *  kalp              @  anı mektubu
   >  çıkış (ikiniz de gelince biter)     |  kayıt noktası
   e  kıskançlık canavarı (üstüne zıpla)
   a b c d  basınç düğmesi → A B C D kapısını açar
   q r s t  kol (✋)       → A B C D kapısını aç/kapa
   groups: { A: { need: 'all', latch: true } } → tüm düğmelere aynı anda basılmalı, sonra açık kalır
   movers: { x, y, w, dx, dy, period }  sürekli gidip gelen platform
           { x, y, w, dx, dy, g: 'A', speed } grubu aktifken hedefe giden platform
   ========================================================= */

function grid(w, h) {
  const g = Array.from({ length: h }, () => Array(w).fill(' '));
  const m = {
    w, h, g,
    set(x, y, c) { if (x >= 0 && x < w && y >= 0 && y < h) g[y][x] = c; return m; },
    fill(x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.set(x, y, c); return m; },
    ground(x0, x1, top, c = '#') { return m.fill(x0, 0, x1, top, c); },
    row(x0, x1, y, c) { return m.fill(x0, y, x1, y, c); },
    clear(x0, y0, x1, y1) { return m.fill(x0, y0, x1, y1, ' '); },
    hearts(list) { list.forEach(([x, y]) => m.set(x, y, '*')); return m; },
  };
  return m;
}

export const LEVELS = [
  {
    name: 'Çiçek Bahçesi', theme: 'garden',
    hint: 'Biri düğmede beklerken diğeri kapıdan geçsin. Yüksek duvarda birbirinizin omzuna çıkın! 🤝',
    build() {
      const m = grid(72, 14);
      m.ground(0, 13, 2).ground(14, 18, 3).ground(19, 25, 4).ground(29, 71, 4);
      m.row(26, 28, 0, '~');
      m.set(2, 3, '1').set(4, 3, '2');
      m.row(31, 33, 6, '-');
      m.set(30, 5, '|').set(34, 5, 'a').fill(37, 5, 37, 9, 'A').set(40, 5, 'a').set(42, 5, '|');
      m.fill(46, 5, 47, 7, '#').fill(46, 5, 47, 6, 'B').set(47, 8, '@').set(51, 5, 'b').set(52, 5, '|');
      m.row(58, 61, 7, '-');
      m.set(67, 5, '>');
      m.hearts([[7, 4], [9, 4], [11, 4], [15, 5], [17, 5], [21, 6], [23, 6], [27, 8], [32, 8], [53, 6], [55, 6], [57, 6], [59, 8], [60, 8]]);
      return { m };
    },
  },
  {
    name: 'Renkli Köprüler', theme: 'pastel',
    hint: `Mavi bloklar sadece ${NAMES[0]} için, pembe bloklar sadece ${NAMES[1]} için sağlam. 💙💗`,
    build() {
      const m = grid(84, 16);
      m.ground(0, 10, 2).ground(21, 83, 2);
      m.row(11, 20, 0, '~').row(11, 20, 2, '[');
      m.set(2, 3, '1').set(4, 3, '2');
      m.set(22, 3, '|').set(23, 3, 'a');
      m.set(26, 4, ']').set(28, 6, ']').set(30, 8, ']');
      m.fill(33, 3, 34, 8, '#').fill(33, 3, 34, 4, 'B');
      m.set(30, 10, '@');
      m.set(37, 3, 'r').set(38, 3, '|');
      m.clear(42, 0, 57, 2).row(42, 57, 0, '~');
      [44, 47, 50, 53, 56].forEach(x => m.set(x, 2, '['));
      [43, 46, 49, 52, 55].forEach(x => m.set(x, 4, ']'));
      m.set(59, 3, '|');
      m.row(61, 64, 5, '[').set(63, 6, 'c').fill(67, 3, 67, 8, 'C').set(69, 3, 'c').set(70, 3, '|');
      m.set(79, 3, '>');
      m.hearts([[6, 4], [8, 4], [13, 4], [16, 4], [19, 4], [26, 5], [28, 7], [30, 9], [45, 3], [48, 3], [51, 3], [54, 3],
        [44, 6], [47, 6], [50, 6], [53, 6], [62, 7], [64, 7], [74, 4], [76, 4]]);
      return { m, movers: [{ x: 11, y: 4, w: 2, dx: 8, dy: 0, g: 'A', speed: 3 }] };
    },
  },
  {
    name: 'Gizemli Orman', theme: 'forest',
    hint: 'Yaylar sizi yükseğe fırlatır. Kolların yanında ✋ (E / S / ↓) ile kapıları açın. 🌲',
    build() {
      const m = grid(92, 18);
      m.ground(0, 12, 2).ground(25, 55, 2).ground(59, 74, 8).ground(75, 91, 2);
      m.row(13, 24, 0, '~').row(56, 58, 0, '~');
      m.set(2, 3, '1').set(4, 3, '2');
      m.set(26, 3, '|').set(29, 3, 'o').row(28, 37, 8, '-').set(36, 9, 'q').set(31, 11, '@');
      m.fill(41, 3, 41, 13, 'A').set(43, 3, 'b').fill(45, 3, 45, 13, 'B').set(47, 3, 'b').set(49, 3, '|');
      m.set(60, 9, '|');
      m.clear(64, 8, 66, 8).row(64, 66, 8, '^');
      m.set(76, 3, '|').set(80, 3, 'o').row(78, 84, 8, '-');
      m.set(88, 3, '>');
      m.hearts([[6, 4], [8, 4], [10, 4], [16, 5], [19, 5], [22, 5], [30, 9], [32, 9], [34, 9], [43, 5], [52, 4], [57, 6],
        [61, 10], [69, 10], [72, 10], [79, 9], [81, 9], [83, 9]]);
      return {
        m, movers: [
          { x: 13, y: 2, w: 3, dx: 9, dy: 0, period: 3.5 },
          { x: 57, y: 2, w: 2, dx: 0, dy: 6, period: 4 },
        ],
      };
    },
  },
  {
    name: 'Buz Dağı', theme: 'ice',
    hint: 'Buz kaygandır, dikkat! İki düğmeye aynı anda basarsanız kapı kalıcı olarak açılır. ❄️',
    build() {
      const m = grid(96, 18);
      m.ground(0, 10, 2).ground(11, 40, 2, 'I').ground(41, 60, 2).ground(75, 95, 2, 'I');
      m.set(2, 3, '1').set(4, 3, '2').set(12, 3, '|');
      [[16, 17], [25, 27], [33, 34]].forEach(([a, b]) => m.row(a, b, 2, '^'));
      m.row(47, 51, 5, '-').set(44, 3, 'a').set(49, 6, 'a').set(50, 8, '@').fill(55, 3, 55, 12, 'A').set(57, 3, '|');
      m.clear(61, 0, 74, 2).row(61, 74, 0, '^');
      m.set(76, 3, '|');
      m.set(80, 4, '[').set(82, 6, '[').set(84, 8, '[').set(84, 9, 's').fill(90, 3, 90, 14, 'C');
      m.set(93, 3, '>');
      m.hearts([[6, 4], [16, 5], [21, 4], [26, 5], [30, 4], [33, 5], [44, 5], [52, 4], [64, 5], [71, 5], [80, 6], [82, 8], [86, 10]]);
      return {
        m, groups: { A: { need: 'all', latch: true } }, movers: [
          { x: 61, y: 2, w: 3, dx: 5, dy: 0, period: 3 },
          { x: 69, y: 2, w: 3, dx: 3, dy: 0, period: 2.4 },
        ],
      };
    },
  },
  {
    name: 'Gece Şehri', theme: 'night',
    hint: 'Kıskançlık canavarlarının üstüne zıplayın, yandan değmeyin! 🌃',
    build() {
      const m = grid(100, 20);
      m.ground(0, 14, 2).ground(15, 20, 5).ground(24, 29, 7).ground(33, 38, 5).ground(42, 48, 7)
        .ground(52, 70, 4).ground(74, 78, 2).ground(80, 86, 8).ground(90, 99, 4);
      m.set(2, 3, '1').set(4, 3, '2');
      m.set(10, 3, 'e').set(13, 3, 'o');
      m.set(18, 6, 'e').set(25, 8, '|');
      m.set(36, 6, 'e');
      m.row(44, 47, 10, '-').set(46, 11, '@').set(43, 8, '|');
      m.set(53, 5, '|').set(55, 5, 'a').set(57, 5, 'e').fill(60, 5, 60, 14, 'A').set(63, 5, 'a').set(67, 5, 'e');
      m.set(75, 3, '|').set(77, 3, 'o');
      m.set(83, 9, 'e');
      m.set(91, 5, '|').set(96, 5, '>');
      m.hearts([[6, 4], [8, 4], [17, 7], [19, 7], [22, 9], [26, 9], [28, 9], [31, 8], [35, 7], [37, 7], [40, 9], [45, 9], [47, 12],
        [54, 6], [65, 6], [69, 6], [72, 6], [81, 10], [85, 10], [88, 8]]);
      return { m };
    },
  },
  {
    name: 'Şeker Diyarı', theme: 'candy',
    hint: 'Renkler, kollar, asansörler... Hepsini birlikte çözün! 🍭',
    build() {
      const m = grid(100, 20);
      m.ground(0, 37, 2).ground(42, 55, 8).ground(56, 58, 4).ground(75, 99, 4);
      m.set(2, 3, '1').set(4, 3, '2').set(10, 3, '|');
      m.set(14, 4, ']').set(16, 6, ']').set(18, 8, ']').row(19, 27, 8, ']').set(27, 9, 'a').set(22, 10, '@');
      m.row(20, 23, 2, '^').row(19, 24, 4, '[').set(26, 3, 'a');
      m.fill(32, 3, 32, 16, 'A').set(34, 3, '|').set(35, 3, 'r');
      m.row(38, 41, 0, '~');
      m.set(43, 9, '|').set(47, 9, 'e').set(52, 9, 'e');
      m.row(59, 74, 0, '~').set(57, 5, '|');
      m.set(76, 5, '|').set(78, 5, 'c').fill(82, 5, 82, 16, 'C').set(85, 5, 'c').set(88, 5, 'e').set(95, 5, '>');
      m.hearts([[6, 4], [8, 4], [14, 5], [16, 7], [18, 9], [20, 9], [24, 9], [20, 5], [23, 5], [39, 6], [45, 10], [50, 10], [54, 10],
        [62, 7], [70, 7], [80, 6], [90, 6], [92, 6]]);
      return {
        m, groups: { A: { need: 'all', latch: true } }, movers: [
          { x: 38, y: 2, w: 3, dx: 0, dy: 6, g: 'B', speed: 2.5 },
          { x: 59, y: 4, w: 2, dx: 6, dy: 0, period: 3 },
          { x: 67, y: 4, w: 2, dx: 6, dy: 0, period: 3, phase: 0.5 },
        ],
      };
    },
  },
  {
    name: 'Bulutların Üstü', theme: 'clouds',
    hint: 'Aşağısı boşluk — düşmeyin! Bulutlara alttan zıplayıp çıkabilirsiniz. ☁️',
    build() {
      const m = grid(110, 22);
      m.fill(0, 2, 10, 4, '#').set(2, 5, '1').set(4, 5, '2').set(8, 5, '|');
      m.row(13, 16, 5, '-').row(19, 22, 7, '-').row(25, 28, 6, '-');
      m.fill(41, 3, 50, 5, '#').set(43, 6, '|').set(45, 6, 'e').set(48, 6, 'o').row(45, 52, 11, '-').set(50, 12, '@');
      m.row(54, 57, 4, '-').row(60, 63, 3, '-');
      m.set(64, 5, ']').row(66, 69, 6, ']').row(66, 69, 3, '[');
      m.fill(72, 2, 80, 4, '#').set(73, 5, '|').set(75, 5, 'a').fill(78, 5, 78, 15, 'A').set(80, 5, 'a');
      m.fill(87, 8, 97, 10, '#').set(88, 11, '|').set(91, 11, 'e').set(95, 11, 'e');
      m.fill(100, 5, 109, 7, '#').set(101, 8, '|').set(106, 8, '>');
      m.hearts([[7, 5], [14, 6], [15, 6], [20, 8], [21, 8], [26, 7], [27, 7], [33, 8], [36, 8], [44, 7], [47, 12], [49, 12],
        [55, 5], [61, 4], [62, 4], [67, 4], [68, 4], [67, 7], [68, 7], [76, 6], [84, 8], [90, 12], [93, 12], [103, 8], [104, 8]]);
      return {
        m, movers: [
          { x: 30, y: 6, w: 3, dx: 8, dy: 0, period: 4 },
          { x: 83, y: 4, w: 2, dx: 0, dy: 6, period: 4 },
        ],
      };
    },
  },
  {
    name: 'Yıldızlara Merdiven', theme: 'stars',
    hint: 'Son tırmanış! Öğrendiğiniz her şey burada. Yıldızlara birlikte! ✨',
    build() {
      const m = grid(110, 24);
      m.ground(0, 45, 2).ground(61, 78, 2);
      m.set(2, 3, '1').set(4, 3, '2');
      m.fill(15, 3, 16, 5, '#').fill(15, 3, 16, 4, 'B').set(19, 3, 'b').set(21, 3, '|').set(24, 3, 'e');
      m.row(26, 28, 5, '[').set(27, 6, 'a').set(30, 4, ']').row(32, 34, 6, ']').set(33, 7, 'a').set(32, 9, '@');
      m.fill(38, 3, 38, 18, 'A').set(40, 3, '|').set(44, 3, 's');
      m.row(46, 60, 0, '~');
      m.set(62, 3, '|').set(64, 3, 'e').set(70, 3, 'e').row(66, 68, 5, '-').row(72, 74, 6, '-');
      m.set(77, 3, 'o').row(79, 83, 8, '-');
      m.fill(89, 12, 109, 14, '#').set(90, 15, '|').set(95, 15, 'd').set(98, 15, 'd').fill(102, 15, 102, 23, 'D').set(106, 15, '>');
      m.hearts([[7, 4], [9, 4], [12, 4], [18, 4], [22, 4], [27, 7], [30, 5], [33, 8], [34, 8], [42, 4], [50, 4], [54, 4], [58, 4],
        [66, 6], [73, 7], [80, 9], [82, 9], [85, 11], [92, 16], [100, 16], [104, 16]]);
      return {
        m, groups: { A: { need: 'all', latch: true }, D: { need: 'all', latch: true } }, movers: [
          { x: 46, y: 2, w: 3, dx: 12, dy: 0, g: 'C', speed: 3 },
          { x: 85, y: 8, w: 2, dx: 0, dy: 5, period: 4 },
        ],
      };
    },
  },
];
