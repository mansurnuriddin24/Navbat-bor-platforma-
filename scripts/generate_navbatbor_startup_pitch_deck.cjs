const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');
const autoTable = require('jspdf-autotable').default || require('jspdf-autotable');
require('dotenv').config();

function createPitchDeckAndGuidePDF() {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // Colors
  const COLOR_PRIMARY = [67, 56, 202];     // Indigo
  const COLOR_DARK = [15, 23, 42];          // Slate 900
  const COLOR_TEXT = [51, 65, 85];          // Slate 700
  const COLOR_MUTED = [100, 116, 139];      // Slate 500
  const COLOR_LIGHT_BG = [248, 250, 252];   // Slate 50
  const COLOR_CARD_BG = [241, 245, 249];    // Slate 100
  const COLOR_BORDER = [226, 232, 240];     // Slate 200
  const COLOR_EMERALD = [5, 150, 105];      // Emerald 600
  const COLOR_AMBER = [217, 119, 6];        // Amber 600

  // Helper to normalize characters for jsPDF default Helvetica
  function clean(text) {
    if (!text) return '';
    return String(text)
      .replace(/[‘ʻ`´]/g, "'")
      .replace(/[’ʼ]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/–/g, '-')
      .replace(/—/g, ' - ')
      .replace(/•/g, '*');
  }

  // Draw Header and Footer on every content page
  function addHeaderFooter(pageNum, totalPages, title = 'NAVBATBOR - STARTUP TAQDIMOTI VA TIZIM QO\'LLANMASI') {
    doc.saveGraphicsState();
    // Header
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.line(margin, 12, pageWidth - margin, 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_PRIMARY);
    doc.text('NAVBATBOR PLATFORMA', margin, 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(clean(title), pageWidth - margin, 9, { align: 'right' });

    // Footer
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_MUTED);
    doc.text('Rasmiy Startup Taqdimoti | https://navbatbor.uz | Tel: +998 (20) 023-25-40', margin, pageHeight - 8);
    doc.text(`Sahifa ${pageNum} / ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    doc.restoreGraphicsState();
  }

  // Draw Card Container
  function drawCard(x, y, w, h, title, subtitle = '') {
    doc.saveGraphicsState();
    doc.setFillColor(...COLOR_LIGHT_BG);
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y, w, h, 3, 3, 'FD');

    if (title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...COLOR_PRIMARY);
      doc.text(clean(title), x + 4, y + 6);
    }
    if (subtitle) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...COLOR_MUTED);
      doc.text(clean(subtitle), x + 4, y + 10);
    }
    doc.restoreGraphicsState();
  }

  // =========================================================================
  // SAHIFA 1: TITUL VARAQASI (COVER PAGE)
  // =========================================================================
  // Gradient/Colored Accent Bar
  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(0, 0, pageWidth, 12, 'F');

  // Decorative Accent Block
  doc.setFillColor(...COLOR_CARD_BG);
  doc.roundedRect(margin, 30, contentWidth, 75, 4, 4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('NAVBATBOR', margin + 8, 55);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...COLOR_DARK);
  doc.text(clean('Xizmat Ko\'rsatish Sohasini Raqamlashtiruvchi Milliy Ekosistema'), margin + 8, 68);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(clean('Aqlli Jonli Navbat, Onlayn Qabul Bronlash va Kassa Boshqaruvi (SaaS Platform)'), margin + 8, 77);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...COLOR_EMERALD);
  doc.text(clean('>> "Navbatda kutishni unut - Vaqtingni tejashni tanla!"'), margin + 8, 92);

  // Subtitle / Document Type
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLOR_DARK);
  doc.text(clean('STARTUP INVESTITSIYA TAQDIMOTI (PITCH DECK)'), margin, 122);
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(clean('Va Sayt & Telegram Botlarning Mukammal Foydalanish Qo\'llanmasi'), margin, 130);

  // Key Highlight Pillars
  const colW = (contentWidth - 6) / 3;
  drawCard(margin, 145, colW, 40, '1. Web Platforma');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(clean('Tezkor PWA sayt:\nmijozlar va biznes egalari\nuchun qulay boshqaruv\ncabineti va monitoring.'), margin + 4, 157);

  drawCard(margin + colW + 3, 145, colW, 40, '2. Ikkala Telegram Bot');
  doc.text(clean('@Navbat1Uzb_bot (Mijozlar)\n@navbatbor_bizness_bot\n(Biznes egalari & xodimlar)\nIlova o\'rnatish shart emas!'), margin + colW + 7, 157);

  drawCard(margin + (colW + 3) * 2, 145, colW, 40, '3. Jonli TV Monitor');
  doc.text(clean('Kutish zallari uchun\nkatta ekranli interaktiv\ntablo va ovozli navbat\nchaqirish moduli.'), margin + (colW + 3) * 2 + 4, 157);

  // Meta Information Box
  doc.setFillColor(...COLOR_CARD_BG);
  doc.setDrawColor(...COLOR_BORDER);
  doc.roundedRect(margin, 205, contentWidth, 55, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(clean('LOYIHA PASPORTI VA MUALLIFLIK MA\'LUMOTLARI:'), margin + 6, 215);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(clean('* Loyiha asoschisi va bosh ma\'mur: Nuriddinov Mansur'), margin + 6, 224);
  doc.text(clean('* Asosiy faoliyat sektori: GovTech / HealthTech / Service SaaS'), margin + 6, 231);
  doc.text(clean('* Dastlabki pilot hudud: Qarshi shahri, Qashqadaryo viloyati'), margin + 6, 238);
  doc.text(clean('* Veb-manzil: https://navbatbor.uz'), margin + 6, 245);
  doc.text(clean('* Rasmiy aloqa: +998 (20) 023-25-40 | Telegram: @mansur_0511'), margin + 6, 252);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(clean('Ushbu hujjat investorlar, hamkorlar, biznes egalari va administratorlar uchun tayyorlangan.'), margin, 275);

  // =========================================================================
  // SAHIFA 2: BOZOR MUAMMOSI VA NAVBATBOR YECHIMI
  // =========================================================================
  doc.addPage();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(clean('1. BOZOR MUAMMOSI (THE PROBLEM)'), margin, 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(
    clean('O\'zbekistonda xizmat ko\'rsatish sohalari (stomatologiya, klinikalar, go\'zallik salonlari, avtoservislar va davlat idoralari) ' +
    'hali ham an\'anaviy qog\'oz daftarlar yoki "jonli tartibsiz navbat" tizimida ishlamoqda. Bu jiddiy iqtisodiy va ijtimoiy yo\'qotishlarga olib kelmoqda:'),
    margin, 32, { maxWidth: contentWidth }
  );

  autoTable(doc, {
    startY: 45,
    margin: { left: margin, right: margin },
    head: [['Muammo Ko\'rinishi', 'Mijozlarga Ta\'siri', 'Biznesga Zarari']],
    body: [
      [
        'Tartibsiz Jonli Navbat',
        'Mijozlar tor koridorlarda 45-90 daqiqa behuda vaqt yo\'qotadi, janjal va norozilik kelib chiqadi.',
        'Mijozlarning 25-30% i uzoq kutish sababli raqobatchilarga ketib qoladi.'
      ],
      [
        'Qo\'ng\'iroq Orqali Yozilish',
        'Telefon band bo\'ladi yoki adashib bir vaqtga ikki mijoz yozib qo\'yiladi (overbooking).',
        'Administrator doimiy telefonda band, mijozlarga e\'tibor pasayadi.'
      ],
      [
        'Shaffoflikning Yo\'qligi',
        'Mijoz navbati qachon kelishini bilmaydi, zalni tark eta olmaydi.',
        'Kassa tushumi va xodimlarning aniq ish unumdorligini nazorat qilib bo\'lmaydi.'
      ],
      [
        'Qimmat Apparatlar',
        'Xorijiy elektron navbat apparatlari $3,000 - $8,000 turadi.',
        'Kichik va o\'rta biznes uchun bunday qimmat uskunalar iqtisodiy jihatdan to\'g\'ri kelmaydi.'
      ]
    ],
    theme: 'grid',
    headStyles: { fillColor: COLOR_PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: COLOR_TEXT, cellPadding: 3 },
    alternateRowStyles: { fillColor: COLOR_LIGHT_BG }
  });

  const problemTableY = doc.lastAutoTable.finalY + 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(clean('2. NAVBATBOR YECHIMI (OUR SOLUTION)'), margin, problemTableY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(
    clean('NavbatBor - hech qanday qimmatbaho uskunalar sotib olishni talab qilmaydigan, to\'liq bulutli, ' +
    'foydalanuvchilar uchun ilova yuklab olishni majbur qilmaydigan zamonaviy gibrid platformadir:'),
    margin, problemTableY + 8, { maxWidth: contentWidth }
  );

  const solW = (contentWidth - 6) / 2;
  const solY = problemTableY + 22;

  drawCard(margin, solY, solW, 42, 'Raqamli Chipta va Jonli Kuzatuv');
  doc.text(clean('* Qog\'ozsiz A-001 formatdagi raqamli chipta\n* Kutish vaqti va oldindagi odamlar soni jonli ko\'rinadi\n* Mijoz kutish zalida emas, kafeda yoki ishda kutishi mumkin'), margin + 4, solY + 12);

  drawCard(margin + solW + 6, solY, solW, 42, 'Telegram orqali Avto-Xabarnoma');
  doc.text(clean('* Navbatga 1-2 kishi qolganda Telegram bot xabar beradi\n* Mijoz navbatini o\'tkazib yubormaydi\n* 100% yetib boruvchi bepul bildirishnomalar'), margin + solW + 10, solY + 12);

  drawCard(margin, solY + 46, solW, 40, 'QR-Kodli Tezkor Navbat');
  doc.text(clean('* Muassasa eshigidagi QR kodni skanerlash kifoya\n* Hech qanday ro\'yxatdan o\'tish talab etilmaydi\n* 3 soniyada chipta qo\'lda'), margin + 4, solY + 58);

  drawCard(margin + solW + 6, solY + 46, solW, 40, 'Biznes uchun Smart CRM & Kassa');
  doc.text(clean('* Mutaxassislar bo\'yicha kunlik hisobot va tushum\n* Xodimning ish staji, reytingi va xizmat narxlari\n* Telegram bot orqali bitta tugmada navbat chaqirish'), margin + solW + 10, solY + 58);

  // =========================================================================
  // SAHIFA 3: PLATFORMA ARXITEKTURASI VA KOMPONENTLARI
  // =========================================================================
  doc.addPage();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(clean('3. PLATFORMA EKOSISTEMASI VA ARXITEKTURASI'), margin, 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(
    clean('NavbatBor tizimi 5 ta mustaqil, lekin bir-biri bilan uzviy sinxronlashgan modullardan iborat:'),
    margin, 31
  );

  autoTable(doc, {
    startY: 37,
    margin: { left: margin, right: margin },
    head: [['Modul', 'Vazifasi', 'Foydalanuvchilar', 'Texnologiyasi']],
    body: [
      [
        'Web Platforma (SaaS)',
        'Asosiy portal: katalog, qidiruv, onlayn bronlash, biznes shaxsiy kabineti, admin panel.',
        'Barcha mijozlar, biznes egalari, ma\'murlar',
        'React 19, Tailwind CSS, Vite, TypeScript'
      ],
      [
        'Mijozlar Boti (@Navbat1Uzb_bot)',
        'Mijozlarga o\'z navbatlarini ko\'rish, bekor qilish, navbat oz qolganda xabar berish.',
        'Mijozlar (bemorlar, xaridorlar)',
        'Telegram Bot API, Deep-linking, Instant WebApp'
      ],
      [
        'Biznes Boti (@navbatbor_bizness_bot)',
        'Biznes egasi va xodimlarga qo\'lidagi kassa: "Keyingi mijozni chaqirish", hisobot, xodim taklif kodi.',
        'Biznes egalari, vrachlar, sartaroshlar, xodimlar',
        'Rolga asoslangan RBAC, State Machine, Real-time'
      ],
      [
        'Jonli TV Tablo (/live-queue/:id)',
        'Kutish zalidagi katta televizor yoki planshetda chiptalarni ko\'rsatish va ovozli e\'lon qilish.',
        'Kutish zalidagi barcha mijozlar',
        'Server-Sent Events (SSE), Web Audio API'
      ],
      [
        'Backend Server & Ma\'lumotlar Bazasi',
        'Yaxlit biznes-logika, atomik tranzaksiyalar, ikki marta bronlashning oldini olish, kaskadli o\'chirish.',
        'Tizim infratuzilmasi',
        'Node.js 24, Express, SQLite WAL (Fast In-memory)'
      ]
    ],
    theme: 'grid',
    headStyles: { fillColor: COLOR_PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: COLOR_TEXT, cellPadding: 2.8 },
    alternateRowStyles: { fillColor: COLOR_LIGHT_BG }
  });

  const archY = doc.lastAutoTable.finalY + 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLOR_DARK);
  doc.text(clean('XAVFSIZLIK VA ISHONCHLILIK KAFOLATLARI:'), margin, archY);

  const secBoxW = (contentWidth - 4) / 2;
  drawCard(margin, archY + 5, secBoxW, 40, 'Ikki Hisobning Qat\'iy Ajratilishi');
  doc.text(clean('* Mijozlar boti va Biznes boti to\'liq mustaqil tokenlarda ishlaydi.\n* Hech qachon bir-biriga xalaqit bermaydi.\n* Xodimlarning amallari audit jurnalida saqlanadi.'), margin + 4, archY + 16);

  drawCard(margin + secBoxW + 4, archY + 5, secBoxW, 40, 'Double-Bookingga Qarshi Dvigatel');
  doc.text(clean('* Bir vaqtga ikki mijoz yozilishi matematik darajada taqiqlangan.\n* Band qilingan slotlar soniyaning ulushida qulflanadi.\n* O\'tib ketgan vaqtga bron qilish mutlaqo cheklangan.'), margin + secBoxW + 8, archY + 16);

  // =========================================================================
  // SAHIFA 4: MIJOZLAR UCHUN SAYTDAN FOYDALANISH QO'LLANMASI
  // =========================================================================
  doc.addPage();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(clean('4. SAYTDAN FOYDALANISH: MIJOZLAR YO\'RIQNOMASI'), margin, 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(clean('Mijozlar NavbatBor saytidan foydalanib 3 xil qulay usulda navbat olishlari mumkin:'), margin, 31);

  // Step by Step Visual Guide
  const stepH = 26;
  let curStepY = 38;

  drawCard(margin, curStepY, contentWidth, stepH, '1-QADAM: Muassasa va Mutaxassisni Tanlash');
  doc.text(clean('Bosh sahifada toifani tanlang (Masalan: Stomatologiya). Shahar faqat Qarshi bo\'lib, muassasalar ichidan\nkeraklisini bosing. Shifokorning tajriba yillari, reytingi (5.0) va sharhlarini ko\'rishingiz mumkin.'), margin + 4, curStepY + 12);

  curStepY += stepH + 4;
  drawCard(margin, curStepY, contentWidth, stepH, '2-QADAM (A): Jonli Navbat Olish (Hozir Bormoqchi Bo\'lsangiz)');
  doc.text(clean('"Jonli Navbat Olish" tugmasini bosing. Kerakli xizmatni tanlab, ismingiz va telefon raqamingizni kiriting.\nSizga bir zumda A-001 kabi raqamli chipta beriladi va oldingizda necha kishi borligi ko\'rsatiladi.'), margin + 4, curStepY + 12);

  curStepY += stepH + 4;
  drawCard(margin, curStepY, contentWidth, stepH, '2-QADAM (B): Oldindan Bronlash (Boshqa Kunga yoki Soatga)');
  doc.text(clean('"Qabulga Yozilish" tugmasini bosing. Mutaxassis, xizmat turi, qulay sana va bo\'sh soat slotini (masalan: 14:30)\ntanlang. Tasdiqlash tugmasini bosishingiz bilan bron muassasa tizimida mustahkam saqlanadi.'), margin + 4, curStepY + 12);

  curStepY += stepH + 4;
  drawCard(margin, curStepY, contentWidth, stepH, '3-QADAM: Telegram Bot orqali Avtomatik Eslatish');
  doc.text(clean('Saytda Telegram bilan ulanganingizda, navbatingizga 1-2 kishi qolganida Telegramingizga ogohlantirish keladi:\n"Sizdan oldinda faqat 1 kishi qoldi. Iltimos, qabul xonasiga yaqinlashing!".'), margin + 4, curStepY + 12);

  curStepY += stepH + 4;
  drawCard(margin, curStepY, contentWidth, stepH, '4-QADAM: Eshikdagi QR-Kodni Skanerlash (Tezkor)');
  doc.text(clean('Muassasaga kelganingizda, eshikdagi maxsus NavbatBor QR-kodini kamerangiz bilan skaner qilsangiz,\nbir zumda avtomatik navbatga qo\'shilasiz. Ilova yuklab olish shart emas!'), margin + 4, curStepY + 12);

  // =========================================================================
  // SAHIFA 5: BIZNES EGASI VA XODIMLAR YO'RIQNOMASI
  // =========================================================================
  doc.addPage();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(clean('5. BIZNES EGASI VA XODIMLAR YO\'RIQNOMASI'), margin, 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(clean('Biznes egalari saytdagi shaxsiy kabinet yoki Telegram Biznes Boti orqali butun jarayonni boshqaradilar:'), margin, 31);

  autoTable(doc, {
    startY: 38,
    margin: { left: margin, right: margin },
    head: [['Bo\'lim / Funksiya', 'Qanday Amalga Oshiriladi', 'Natija']],
    body: [
      [
        'Biznes Kabinetiga Kirish',
        'Sayt yuqorisidagi "Hamkorlar / Biznes Kirish" tugmasini bosing. Telefon yoki Telegram orqali 1 marta bosib kiring.',
        'Barcha boshqaruv bo\'limlari bir zumda ochiladi.'
      ],
      [
        'Xodimlar va Mutaxassislar',
        'Xodimlar bo\'limidan "Yangi xodim qo\'shish". Ismi, ixtisosligi, ish staji (tajriba yillari) va telefonini kiriting.',
        'Xodimga maxsus STF-1001 taklif kodi beriladi. Xodim botga shu kod bilan ulanadi.'
      ],
      [
        'Tajriba Yillarini O\'zgartirish',
        'Xodimlar jadvalida "Tajribani tahrirlash" tugmasini bosing va kerakli yilni kiriting.',
        'Mijozlar saytda mutaxassis stajini (masalan: 5 yil tajriba) aniq ko\'radi.'
      ],
      [
        'Xizmatlar va Narxlar',
        'Xizmat nomi, davomiyligi (daqiqada) va narxini belgilang. Narxlar mijozlarga shaffof ko\'rsatiladi.',
        'Hisob-kitoblar aniq bo\'ladi, kassa tushumi avtomatlashadi.'
      ],
      [
        'Ish Vaqti Jadvali',
        'Hafta kunlari bo\'yicha ish boshlanishi va tugash soatlarini, tushlik tanaffusini kiriting.',
        'Faqat ish vaqtiga mijozlar bron qila oladi.'
      ],
      [
        'Navbatni Boshqarish (Pult)',
        'Telegram botda yoki saytda "Keyingi mijozni chaqirish", "Qabul qilish", "Xizmatni yakunlash" tugmalari.',
        'Zaldagi TV tabloda navbat avtomatik chaqiriladi va yangilanadi.'
      ],
      [
        'Walk-In (Jonli Mijoz Qo\'shish)',
        'Telefon qilib kelgan yoki to\'g\'ridan-to\'g\'ri kirib kelgan mijozni 1 soniyada navbatga qo\'shish.',
        'Umumiy navbat va hisobot buzilmaydi.'
      ],
      [
        'Kunlik Moliyaviy Hisobot',
        'Kun yakunida qancha mijoz kelgani, xizmatlar kesimida tushum va xodimlar ulushi ko\'rinadi.',
        'Kassa shaffofligi ta\'minlanadi, o\'g\'irlik va yo\'qotishlar yo\'qoladi.'
      ]
    ],
    theme: 'grid',
    headStyles: { fillColor: COLOR_PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 7.8, textColor: COLOR_TEXT, cellPadding: 2.5 },
    alternateRowStyles: { fillColor: COLOR_LIGHT_BG }
  });

  // =========================================================================
  // SAHIFA 6: SUPER ADMIN BOSHQARUV PANELI
  // =========================================================================
  doc.addPage();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(clean('6. SUPER ADMIN BOSHQARUV PANELI (#admin)'), margin, 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(clean('Platforma bosh koordinatori (Mansur Nuriddinov) uchun maxsus yaratilgan to\'liq boshqaruv markazi:'), margin, 31);

  autoTable(doc, {
    startY: 38,
    margin: { left: margin, right: margin },
    head: [['Admin Imkoniyati', 'Bajariladigan Amal', 'Xavfsizlik & Nazorat']],
    body: [
      [
        'Biznes Arizalarini Ko\'rib Chiqish',
        'Yangi ariza topshirgan korxonalarni tekshirish, "Tasdiqlash" (14 kunlik Trial berish) yoki rad etish.',
        'Faqat tekshirilgan va qonuniy faoliyat yurituvchi bizneslar qabul qilinadi.'
      ],
      [
        'Biznesni Butunlay O\'chirish',
        'Muassasalar jadvali va tafsilotlar oynasida qizil "O\'chirish" tugmasi.',
        'Tasdiqlash so\'raladi; barcha 15 ta bog\'liq jadvallar (xodimlar, navbatlar) xavfsiz kaskadli tozalanadi.'
      ],
      [
        'Obuna va Tariflarni Uzaytirish',
        'Har bir biznes uchun "+1 oy" tugmasi orqali obunani uzaytirish, tarif turini o\'zgartirish.',
        'Muddati tugagan korxonalar avtomatik ogohlantiriladi.'
      ],
      [
        'Moliya va Xarajatlar Tahlili',
        'Platformaning yalpi daromadi, operatsion xarajatlari (server, SMS, soliq) va sof foyda hisobi.',
        'Moliya grafigi va avtomatlashtirilgan oylik balans hisoboti.'
      ],
      [
        'Reklama Arizalarini Boshqarish',
        'TOP o\'ringa chiqmoqchi bo\'lgan korxonalarning reklama arizalarini tasdiqlash.',
        'Mablag\' qabul qilingandan so\'ng saytda birinchi o\'ringa chiqariladi.'
      ],
      [
        'Kechki Soat 22:00 Avto-Hisobot',
        'Har kuni soat 22:00 da Super Admin Telegramiga tizimning to\'liq umumiy hisoboti yuboriladi.',
        'Kun davomidagi barcha navbatlar, bronlar va moliyaviy oqimlar jamlanadi.'
      ]
    ],
    theme: 'grid',
    headStyles: { fillColor: COLOR_PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: COLOR_TEXT, cellPadding: 2.8 },
    alternateRowStyles: { fillColor: COLOR_LIGHT_BG }
  });

  // =========================================================================
  // SAHIFA 7: BIZNES MODEL VA MONETIZATSIYA REJASI
  // =========================================================================
  doc.addPage();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(clean('7. BIZNES MODEL VA MONETIZATSIYA (REVENUE MODEL)'), margin, 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(clean('NavbatBor loyihasi barqaror SaaS obuna va qo\'shimcha xizmatlar orqali ko\'p tarmoqli daromad keltiradi:'), margin, 31);

  autoTable(doc, {
    startY: 38,
    margin: { left: margin, right: margin },
    head: [['Tarif Rejasi', 'Oylik Narxi', 'Kimlar Uchun', 'Imkoniyatlar']],
    body: [
      [
        '14 Kunlik Bepul Sinov',
        '0 UZS',
        'Barcha yangi bizneslar',
        'To\'liq funksional, 2 ta xodim, jonli navbat, Telegram bot'
      ],
      [
        'START',
        '150,000 UZS / oy',
        'Kichik salonlar, 1-2 xonali stomatologiyalar',
        '1 ta filial, 5 tagacha xodim, cheksiz jonli navbat, Telegram bildirishnoma'
      ],
      [
        'PRO (Ommabop)',
        '350,000 UZS / oy',
        'O\'rta klinikalar, mashhur salonlar, diagnostika',
        '15 tagacha xodim, onlayn bronlash, SMS integratsiya, mutaxassis tahlili'
      ],
      [
        'PREMIUM / VIP',
        '700,000 UZS / oy',
        'Katta shifoxonalar, tarmoq markazlar',
        'Cheksiz xodimlar, ko\'p filialli boshqaruv, TV tablo tizimi, shaxsiy menejer'
      ]
    ],
    theme: 'grid',
    headStyles: { fillColor: COLOR_PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: COLOR_TEXT, cellPadding: 3 },
    alternateRowStyles: { fillColor: COLOR_LIGHT_BG }
  });

  const revY = doc.lastAutoTable.finalY + 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLOR_DARK);
  doc.text(clean('QO\'SHIMCHA DAROMAD MANBALARI:'), margin, revY);

  const cardW = (contentWidth - 6) / 2;
  drawCard(margin, revY + 5, cardW, 35, 'TOP Reklama va Bannerlar');
  doc.text(clean('* Saytning eng yuqori qismida "Tavsiya etiladi" bloki\n* Narxi: 300,000 - 500,000 UZS / oy\n* Bir vaqtda 5 tagacha biznes reklama joylashtirishi mumkin'), margin + 4, revY + 16);

  drawCard(margin + cardW + 6, revY + 5, cardW, 35, 'SMS va Maxsus Uskunalar');
  doc.text(clean('* Maxsus eslatma SMS paketlari (har bir SMS 120 so\'mdan)\n* Zallar uchun tayyor TV monitor planshetlarini o\'rnatish\n* Korporativ integratsiya va o\'qitish xizmati'), margin + cardW + 10, revY + 16);

  // 1-Year Financial Forecast Box
  doc.setFillColor(...COLOR_CARD_BG);
  doc.setDrawColor(...COLOR_BORDER);
  doc.roundedRect(margin, revY + 48, contentWidth, 38, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(clean('1 YILLIK DASTLABKI PROGNOZ (QARSHI SHAHRI MISOLIDA):'), margin + 5, revY + 56);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(clean('* Rejalashtirilgan mijoz-bizneslar soni: 100 ta korxona (O\'rtacha PRO tarifda)'), margin + 5, revY + 64);
  doc.text(clean('* Oylik kutilayotgan SaaS tushumi: 100 x 350,000 = 35,000,000 UZS / oy'), margin + 5, revY + 71);
  doc.text(clean('* Reklama va qo\'shimcha xizmatlar: ~10,000,000 UZS / oy'), margin + 5, revY + 78);
  doc.text(clean('* Yillik yalpi daromad: ~540,000,000 UZS (Sof rentabellik: 65-70%)'), margin + 5, revY + 84);

  // =========================================================================
  // SAHIFA 8: BOZOR, RAQOBAT VA SCALE (KENGAYISH) REJASI
  // =========================================================================
  doc.addPage();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(clean('8. RAQOBAT VA KENGAYISH STRATEGIYASI (GO-TO-MARKET)'), margin, 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(clean('NavbatBor an\'anaviy navbat tizimlaridan keskin ajralib turadi:'), margin, 31);

  autoTable(doc, {
    startY: 38,
    margin: { left: margin, right: margin },
    head: [['Mezon', 'NavbatBor', 'An\'anaviy Qimmat Tablolar', 'Chet El Ilovalari']],
    body: [
      ['Narxi', 'Oyiga 150-350 ming so\'m', '$3,000 - $8,000 xarid narxi', 'Oyiga $100 - $300 (valyutada)'],
      ['O\'rnatish', '1 daqiqada (Brauzer & Bot)', '2-3 hafta montaj va kabellar', 'Murakkab o\'rnatish'],
      ['Ilova Yuklash', 'Shart emas (Web & Telegram)', 'Faqat monitor orqali', 'Har bir mijoz yuklashi shart'],
      ['Xabarnoma', 'Telegram orqali 100% yetib boradi', 'Faqat zaldagi ekranda', 'Push (ko\'pincha o\'chiq bo\'ladi)'],
      ['Mahalliy Bozor', 'O\'zbekiston va Qarshi shahriga to\'liq mos', 'Moslashtirilmagan', 'Mahalliy to\'lovlar yo\'q']
    ],
    theme: 'grid',
    headStyles: { fillColor: COLOR_PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: COLOR_TEXT, cellPadding: 2.8 },
    alternateRowStyles: { fillColor: COLOR_LIGHT_BG }
  });

  const scaleY = doc.lastAutoTable.finalY + 12;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLOR_DARK);
  doc.text(clean('BOSQICHMA-BOSQICH KENGAYISH YO\'L XARITASI (ROADMAP):'), margin, scaleY);

  const phaseW = (contentWidth - 6) / 3;
  drawCard(margin, scaleY + 6, phaseW, 45, '1-Bosqich (2026 Q3-Q4)');
  doc.text(clean('* Qarshi shahri pilot sinovi\n* Stomatologiya va salonlar\n* Dastlabki 50 ta hamkor\n* Real foydalanuvchilar fikri'), margin + 4, scaleY + 18);

  drawCard(margin + phaseW + 3, scaleY + 6, phaseW, 45, '2-Bosqich (2027 Q1-Q2)');
  doc.text(clean('* Samarqand, Buxoro, Qarshi\n* Click, Payme avto-to\'lov\n* 300+ faol bizneslar\n* B2B savdo vakillari tarmog\'i'), margin + phaseW + 7, scaleY + 18);

  drawCard(margin + (phaseW + 3) * 2, scaleY + 6, phaseW, 45, '3-Bosqich (2027 Q3-Q4)');
  doc.text(clean('* Toshkent va Respublika bo\'ylab\n* Davlat va xususiy shifoxonalar\n* AI ovozli navbat chaqiruvchi\n* Xalqaro bozorga chiqish (MDH)'), margin + (phaseW + 3) * 2 + 4, scaleY + 18);

  // =========================================================================
  // SAHIFA 9: XULOSA VA INVESTITSIYA TAKLIFI
  // =========================================================================
  doc.addPage();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(clean('9. XULOSA VA BOG\'LANISH'), margin, 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(
    clean('NavbatBor - bu shunchaki navbat dasturi emas, balki xizmat ko\'rsatish madaniyatini tubdan o\'zgartiruvchi, ' +
    'fuqarolarning eng qimmatli boyligi bo\'lgan VAQTNI tejovchi, bizneslarning kassa shaffofligini ta\'minlovchi raqamli infratuzilmadir.'),
    margin, 34, { maxWidth: contentWidth }
  );

  // Final Call to Action Box
  doc.setFillColor(...COLOR_LIGHT_BG);
  doc.setDrawColor(...COLOR_PRIMARY);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, 52, contentWidth, 75, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(clean('BIZ BILAN BIRGA O\'ZBEKISTONNI RAQAMLASHTIRING!'), margin + 8, 64);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(clean('1. Biznes egalari uchun: 14 kunlik bepul sinov muddatidan foydalaning va navbatlarni tartibga soling.'), margin + 8, 76);
  doc.text(clean('2. Investorlar uchun: Yuqori marjali (SaaS) va tez kengayuvchi milliy platformaga sarmoya kiriting.'), margin + 8, 86);
  doc.text(clean('3. Davlat va sog\'liqni saqlash idoralari uchun: Qabul xonalaridagi tirbandlikni to\'liq bartaraf eting.'), margin + 8, 96);
  doc.text(clean('4. Hamkorlar uchun: Har bir hudud bo\'yicha vakillik va agentlik shartnomalarini taklif etamiz.'), margin + 8, 106);
  doc.text(clean('5. Mijozlar uchun: Vaqtingizni asrang - NavbatBor orqali navbat oling!'), margin + 8, 116);

  // Contact Info Footer Card
  doc.setFillColor(...COLOR_CARD_BG);
  doc.setDrawColor(...COLOR_BORDER);
  doc.roundedRect(margin, 140, contentWidth, 50, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_DARK);
  doc.text(clean('RASMIY BOG\'LANISH VA MA\'LUMOTLAR:'), margin + 6, 150);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(clean('* Asoschi va Rahbar: Nuriddinov Mansur'), margin + 6, 159);
  doc.text(clean('* Telefon: +998 (20) 023-25-40 | +998 (90) 886-25-40'), margin + 6, 166);
  doc.text(clean('* Shaxsiy Telegram: @mansur_0511'), margin + 6, 173);
  doc.text(clean('* Rasmiy Platforma Sayti: https://navbatbor.uz'), margin + 6, 180);

  // Apply Headers and Footers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i > 1) {
      addHeaderFooter(i, totalPages);
    }
  }

  return doc;
}

async function run() {
  console.log('Generating NavbatBor Startup Pitch Deck & Guide PDF...');
  const doc = createPitchDeckAndGuidePDF();

  const outDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const pdfFileName = 'NavbatBor_Startup_PitchDeck_va_Qollanma.pdf';
  const outPathPublic = path.join(outDir, pdfFileName);
  const outPathRoot = path.join(process.cwd(), pdfFileName);

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  fs.writeFileSync(outPathPublic, pdfBuffer);
  fs.writeFileSync(outPathRoot, pdfBuffer);

  console.log(`PDF successfully created at:\n1. ${outPathPublic}\n2. ${outPathRoot}`);
  console.log(`PDF Size: ${(pdfBuffer.length / 1024).toFixed(1)} KB | Total Pages: ${doc.getNumberOfPages()}`);

  // Send to Telegram Super Admin
  const adminChatId = '5564730141';
  const botToken = process.env.BUSINESS_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;

  if (botToken && botToken.length > 10) {
    console.log(`Sending PDF via Telegram to Super Admin (${adminChatId})...`);
    try {
      const formData = new FormData();
      formData.append('chat_id', adminChatId);
      formData.append('caption', '📊 <b>NavbatBor: Mukammal Startup Taqdimoti va Tizim Foydalanish Qo‘llanmasi (PDF)</b>\n\n' +
        'Ushbu hujjatda:\n' +
        '• Bozor muammosi va NavbatBor yechimi\n' +
        '• Saytning barcha funksiyalari va qanday ishlatilishi\n' +
        '• Mijozlar, Biznes egalari va Admin yo‘riqnomasi\n' +
        '• SaaS monetizatsiya modeli va 1 yillik moliyaviy prognoz\n' +
        '• Bozor kengayish rejasi (Scale roadmap)\n\n' +
        'Muallif: <b>Mansur Nuriddinov</b>\n' +
        'Platforma: https://navbatbor.uz'
      );
      formData.append('parse_mode', 'HTML');
      const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
      formData.append('document', blob, pdfFileName);

      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.ok) {
        console.log('✅ PDF document successfully sent to Super Admin Telegram!');
      } else {
        console.error('❌ Failed to send PDF to Telegram:', data.description);
      }
    } catch (tgErr) {
      console.error('Telegram sendDocument error:', tgErr.message);
    }
  } else {
    console.log('Bot token not configured for Telegram sending.');
  }
}

run().catch(console.error);
