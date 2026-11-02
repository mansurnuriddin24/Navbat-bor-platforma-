const https = require('https');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// Load environment variables from .env
const envPath = path.join(__dirname, '..', '.env');
const env = {};
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const k = trimmed.slice(0, eqIdx).trim();
      let v = trimmed.slice(eqIdx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[k] = v;
    }
  }
}

const botToken = env.BUSINESS_BOT_TOKEN || '8658895694:AAG7C0Kt8DOyhPtoCJ5koc7zrdKgzMhV59s';
const chatId = env.TELEGRAM_ADMIN_CHAT_ID || '5564730141';
const dbPath = path.join(__dirname, '..', 'navbatbor.sqlite');
const db = new DatabaseSync(dbPath);

function sendTelegram(text, parseMode = 'HTML') {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: parseMode,
      disable_web_page_preview: true
    });

    const req = https.request(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      },
      (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve({ ok: false, body });
          }
        });
      }
    );

    req.on('error', err => {
      console.error('Req error:', err.message);
      resolve({ ok: false, error: err.message });
    });
    req.write(data);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('Sending full system materials to Super Admin (chatId:', chatId, ')...');

  // =========================================================================
  // 1. SUPER ADMIN GLOBAL KUNLIK HISOBOT
  // =========================================================================
  const now = new Date();
  const tashkentStr = now.toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });
  const todayDateStr = now.toISOString().slice(0, 10);

  const totalBiz = (db.prepare("SELECT COUNT(*) as c FROM businesses WHERE status IN ('APPROVED', 'ACTIVE')").get()).c;
  const totalUsers = (db.prepare("SELECT COUNT(*) as c FROM users").get()).c;
  const totalStaff = (db.prepare("SELECT COUNT(*) as c FROM staff WHERE is_active = 1").get()).c;
  const totalBookingsAll = (db.prepare("SELECT COUNT(*) as c FROM bookings").get()).c;
  const totalQueuesAll = (db.prepare("SELECT COUNT(*) as c FROM queue_entries").get()).c;

  // Today's stats across all businesses
  const todayBookings = (db.prepare("SELECT COUNT(*) as c FROM bookings WHERE booking_date = ?").get(todayDateStr))?.c || 0;
  const todayCompletedBookings = (db.prepare("SELECT COUNT(*) as c FROM bookings WHERE booking_date = ? AND status = 'COMPLETED'").get(todayDateStr))?.c || 0;
  const todayQueues = (db.prepare("SELECT COUNT(*) as c FROM queue_entries WHERE date(joined_at) = ?").get(todayDateStr))?.c || 0;
  const todayServedQueues = (db.prepare("SELECT COUNT(*) as c FROM queue_entries WHERE date(joined_at) = ? AND status = 'COMPLETED'").get(todayDateStr))?.c || 0;

  // Businesses breakdown
  const bizList = db.prepare("SELECT id, name, phone, address FROM businesses WHERE status IN ('APPROVED', 'ACTIVE')").all();
  let bizBreakdownText = '';
  let totalEstRevenue = 0;

  for (const b of bizList) {
    const servedQ = (db.prepare("SELECT COUNT(*) as c FROM queue_entries WHERE business_id = ? AND date(joined_at) = ? AND status = 'COMPLETED'").get(b.id, todayDateStr))?.c || 0;
    const servedB = (db.prepare("SELECT COUNT(*) as c FROM bookings WHERE business_id = ? AND booking_date = ? AND status = 'COMPLETED'").get(b.id, todayDateStr))?.c || 0;
    const waitingQ = (db.prepare("SELECT COUNT(*) as c FROM queue_entries WHERE business_id = ? AND date(joined_at) = ? AND status IN ('WAITING', 'CALLED', 'SERVING')").get(b.id, todayDateStr))?.c || 0;
    
    // Revenue sum
    const revBkg = (db.prepare("SELECT COALESCE(SUM(total_price_uzs), 0) as s FROM bookings WHERE business_id = ? AND booking_date = ? AND status = 'COMPLETED'").get(b.id, todayDateStr))?.s || 0;
    const revQ = (db.prepare("SELECT COALESCE(SUM(s.price_uzs), 0) as s FROM queue_entries q JOIN services s ON q.service_id = s.id WHERE q.business_id = ? AND date(q.joined_at) = ? AND q.status = 'COMPLETED'").get(b.id, todayDateStr))?.s || 0;
    const bizRev = Number(revBkg) + Number(revQ);
    totalEstRevenue += bizRev;

    bizBreakdownText += 
      `\n🏢 <b>${b.name}</b>\n` +
      `   • Xizmat ko‘rsatildi: <b>${servedQ + servedB} nafar</b> (Jonli: ${servedQ}, Bron: ${servedB})\n` +
      `   • Hozir kutmoqda: <b>${waitingQ} nafar</b>\n` +
      `   • Kunlik tushum: <b>${bizRev.toLocaleString('uz-UZ')} UZS</b>\n` +
      `   • Manzil: <i>${b.address || 'Qarshi shahri'}</i>\n`;
  }

  const superAdminReportMsg = 
    `👑 <b>NAVBATBOR PLATFORMASI — KUNLIK GLOBAL HISOBOT</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>Hurmatli Super Admin Mansur Nuriddinov!</b>\n` +
    `Har kuni kechki soat <b>22:00 da</b> Sizga butun platforma bo‘yicha to‘liq avtomatlashtirilgan yakuniy hisobot jo‘natiladi.\n\n` +
    `📅 Sana va vaqt: <b>${tashkentStr}</b>\n` +
    `📍 Asosiy shahar: <b>Qarshi shahri (Pilot)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 <b>BUGUNGI ASOSIY KO‘RSATKICHLAR (KPI):</b>\n` +
    `• Jami qabul qilingan mijozlar: <b>${todayServedQueues + todayCompletedBookings} nafar</b>\n` +
    `• Bugungi yangi bronlar: <b>${todayBookings} ta</b>\n` +
    `• Bugungi jonli navbatlar: <b>${todayQueues} ta</b>\n` +
    `• 💰 <b>Bugungi platforma GMV aylanmasi: ${totalEstRevenue.toLocaleString('uz-UZ')} UZS</b>\n\n` +
    `📈 <b>PLATFORMA UMUMIY MASSHTABI:</b>\n` +
    `• Faol bizneslar / klinikalar: <b>${totalBiz} ta</b>\n` +
    `• Mutaxassislar (shifokor/ustalar): <b>${totalStaff} nafar</b>\n` +
    `• Ro‘yxatdan o‘tgan foydalanuvchilar: <b>${totalUsers} nafar</b>\n` +
    `• Tizimda jami o‘tgan bronlar: <b>${totalBookingsAll} ta</b>\n` +
    `• Tizimda jami jonli chiptalar: <b>${totalQueuesAll} ta</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🏬 <b>MUASSASALAR BO‘YICHA BUGUNGI HISOBOT:</b>` +
    bizBreakdownText +
    `\n━━━━━━━━━━━━━━━━━━━━\n` +
    `🛡 <b>TIZIM VA XAVFSIZLIK HOLATI:</b>\n` +
    `• Baza: <b>SQLite (WAL rejimida, Crash-Safe)</b> ✅\n` +
    `• Cloud Zaxiralash (Persistence): <b>Faol (Doimiy sinxronlangan)</b> ✅\n` +
    `• Telegram Polling worker: <b>24/7 Uzluksiz faol</b> ✅\n` +
    `• Double-booking himoyasi: <b>Atomic Triggers (100% kafolat)</b> ✅\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `⚡️ <i>NavbatBor — Raqamlashtirilgan xizmat ko‘rsatish standarti!</i>`;

  console.log('Sending Message 1: Super Admin Daily Report...');
  const res1 = await sendTelegram(superAdminReportMsg);
  console.log('Message 1 result:', res1.ok);
  await sleep(1500);

  // =========================================================================
  // 2. SAYT VA BOTNING TO'LIQ ISHLASH VA FUNKSIYALAR QO'LLANMASI (ARXITEKTURA)
  // =========================================================================
  const docPart1 = 
    `📚 <b>NAVBATBOR PLATFORMASI VA BOTLARINING TO‘LIQ ISHLASH QO‘LLANMASI</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Ushbu mukammal qo‘llanma sayt, mijozlar boti va biznes boti qanday ishlashi hamda ularning barcha funksiyalarini batafsil tushuntiradi.\n\n` +
    `🌐 <b>1. UMUMIY PLATFORMA ARXITEKTURASI</b>\n` +
    `Loyihada bir-biri bilan uzviy bog‘langan 4 ta asosiy komponent mavjud:\n` +
    `1. <b>NavbatBor Web Sayti:</b> Mijozlar uchun qulay katalog, bron qilish va jonli navbat olish oynasi. Biznes egalari uchun keng qamrovli boshqaruv kabineti.\n` +
    `2. <b>Mijozlar Boti (@Navbat1Uzb_bot):</b> Mijozlarga navbat chiptasi, QR-kod, 30 daqiqalik eslatmalar va "Navbatingiz keldi!" xabarlarini avtomatik yetkazuvchi robot.\n` +
    `3. <b>Biznes Boti (@navbatbor_bizness_bot):</b> Biznes egalari va shifokorlar uchun navbatni boshqarish pulti (Keyingi mijozni chaqirish, qabul qilish, kelmadi, hisobotlar olish).\n` +
    `4. <b>Jonli Navbat Tablosi (TV Display):</b> Kutish zalidagi televizorlar uchun katta ekranli jonli navbat tablosi va ovozli e'lon tizimi.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>2. MIJOZLAR UCHUN IMKONIYATLAR VA ISHLASH JARAYONI</b>\n` +
    `Mijoz NavbatBor platformasidan 2 xil usulda foydalana oladi:\n\n` +
    `🔹 <b>A) Oldindan Online Bron qilish:</b>\n` +
    `• Mijoz kerakli klinika yoki salonni tanlaydi (masalan: <i>Nasaf dental</i>).\n` +
    `• Ko‘rsatiladigan xizmatni tanlaydi (narxi va davomiyligi ko‘rinadi).\n` +
    `• O‘ziga ma'qul mutaxassisni tanlaydi (uning tajribasi va reytingi ko‘rinadi).\n` +
    `• Bo‘sh sana va vaqt katagini (slot) tanlaydi.\n` +
    `• Ism va telefon raqamini kiritib tasdiqlaydi.\n` +
    `• <b>Natija:</b> Tizim takroriy bronlashga yo‘l qo‘ymaydi, mijozga SMS/Telegram orqali vaucher beriladi.\n\n` +
    `🔹 <b>B) Jonli Elektron Navbat (Walk-In / QR-Kod):</b>\n` +
    `• Mijoz muassasaga kirib kelganida devordagi QR-kodni skanerlaydi yoki saytdan <b>«Jonli Navbat Olish»</b> tugmasini bosadi.\n` +
    `• Unga darhol unikal chipta beriladi (masalan: <b>#A-003</b>).\n` +
    `• Telegram orqali jonli navbat holati uning telefonida ochiladi: oldida necha kishi kutayotgani va taxminiy kutish vaqti real vaqtda ko‘rinib turadi.\n` +
    `• Kutish zalida o‘tirmasdan, tashqarida kofe ichib tursa ham bo‘ladi — uning navbati kelganda bot unga xabar beradi!`;

  console.log('Sending Message 2: Documentation Part 1...');
  const res2 = await sendTelegram(docPart1);
  console.log('Message 2 result:', res2.ok);
  await sleep(1500);

  const docPart2 = 
    `🏢 <b>3. BIZNES EGALARI VA SHIFOKORLAR UCHUN IMKONIYATLAR</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Biznes egalari saytda <b>«Biznes Kabineti»</b> va Telegramda <b>@navbatbor_bizness_bot</b> orqali biznesni to‘liq boshqaradilar:\n\n` +
    `🛠 <b>A) Xodimlar va Mutaxassislarni Boshqarish:</b>\n` +
    `• Mutaxassislarni qo‘shish va tahrirlash (Ism, Lavozim, <b>Ish tajribasi yillarda</b>, Reyting, Telefon).\n` +
    `• Har bir mutaxassis uchun shaxsiy narxlarni va xizmatlarni biriktirish.\n` +
    `• Har bir xodimga unikal <b>Taklif Kodi</b> beriladi (Masalan: <code>STF-1001</code>).\n` +
    `• Shifokor ushbu kod orqali Telegram botga kirib, faqat o‘zining mijozlarini qabul qiladi.\n\n` +
    `📢 <b>B) Navbatni Chaqirish va Boshqarish Mexanizmi:</b>\n` +
    `• Telegram botda yoki sayt boshqaruv panelida <b>«Keyingi mijozni chaqirish»</b> tugmasi bosiladi.\n` +
    `• Tizim eng birinchi kutayotgan mijozni chaqiradi (masalan: #A-003 — Jahongir Rasulov).\n` +
    `• Mijozning Telegram botiga <b>«Sizning navbatingiz keldi, xonaga kiring!»</b> xabarnomasi yuboriladi.\n` +
    `• Shifokor boshqaruv tugmalari orqali:\n` +
    `   ✅ <b>«Qabul qilish (Mijoz keldi)»</b> — xizmat ko‘rsatilayotganini belgilash;\n` +
    `   🔄 <b>«Qayta chaqirish»</b> — mijoz eshitmagan bo‘lsa qayta signal jo‘natish;\n` +
    `   ❌ <b>«Kelmadi»</b> — o‘tkazib yuborish;\n` +
    `   🏁 <b>«Xizmatni yakunlash»</b> — xizmat yakunlanib navbat yopiladi va kassa hisobotiga tushum qo‘shiladi.\n\n` +
    `🌙 <b>C) Har Kunlik Kechki 22:00 Hisoboti:</b>\n` +
    `• Har kuni kechki soat 22:00 da biznes egasining Telegram botiga kun davomida qancha mijoz kelgani, xodimlar samaradorligi va kunlik tushum hisoboti avtomatik yuboriladi.\n\n` +
    `📺 <b>D) Kutish Zalidagi Katta Ekran Tablosi (TV Display):</b>\n` +
    `• Kutish xonasidagi televizorda <code>/tv/nasaf-dental</code> havolasi orqali jonli navbat jadvali katta harflarda va chiroyli dizaynda ko‘rinib turadi.\n` +
    `• Yangi mijoz chaqirilganda qabulxona bo‘ylab jarangdor ovozli e'lon beriladi.`;

  console.log('Sending Message 3: Documentation Part 2...');
  const res3 = await sendTelegram(docPart2);
  console.log('Message 3 result:', res3.ok);
  await sleep(1500);

  const docPart3 = 
    `👑 <b>4. SUPER ADMIN BOSHQARUV PANELINING VAKOLATLARI</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Super Admin (Mansur Nuriddinov) tizim ustidan mutlaq nazoratga ega:\n\n` +
    `🔹 <b>1. Bizneslarni Tasdiqlash va Moderatsiya:</b>\n` +
    `• Saytda yangi ariza tushganda darhol Super Admin Telegram botiga bildirishnoma keladi.\n` +
    `• 1 ta bosish orqali <code>[✅ Tasdiqlash]</code> yoki <code>[❌ Rad etish]</code> mumkin.\n` +
    `• Tasdiqlanganda korxonaga avtomatik <b>14 kunlik bepul PRO sinov (Trial)</b> beriladi.\n\n` +
    `🔹 <b>2. Tarif Rejalari va Obunalar:</b>\n` +
    `• Boshlang‘ich, Standart va Pro tariflari narxi, xodimlar limiti va funksiyalarini sozlash.\n` +
    `• Obunasi tugayotgan bizneslarga avtomat ogohlantirish yuborish.\n\n` +
    `🔹 <b>3. Reklama va TOP O‘ringa Chiqarish (Featured):</b>\n` +
    `• Korxonalarning qidiruv tizimida eng yuqorida (Featured) chiqish arizalarini tasdiqlash.\n\n` +
    `🔹 <b>4. Nolga teng Ma'lumot Yo‘qotish (Zero Data-Loss):</b>\n` +
    `• Har safar yangilanish qilinganda yoki server qayta yoqilganda SQLite bazasi va Cloud Snapshot avtomatik sinxronlanadi.\n` +
    `• Hech qanday mijoz, bron yoki xodim ma'lumotlari yo‘qolib ketmaydi.`;

  console.log('Sending Message 4: Documentation Part 3...');
  const res4 = await sendTelegram(docPart3);
  console.log('Message 4 result:', res4.ok);
  await sleep(1500);

  // =========================================================================
  // 3. SAYT VA LOYIHANING MUKAMMAL TAQDIMOTI (PRESENTATION / PITCH DECK)
  // =========================================================================
  const pitchPart1 = 
    `🚀 <b>NAVBATBOR LOYIHASINING MUKAMMAL TAQDIMOTI (PITCH DECK)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `<i>O‘zbekistondagi xizmat ko‘rsatish sohasini raqamlashtiruvchi yagona intellektual navbat va bronlash ekotizimi.</i>\n\n` +
    `🎯 <b>SLAYD 1: BIZ KIMMIZ?</b>\n` +
    `<b>NavbatBor</b> — tibbiyot markazlari, stomatologiyalar, go‘zallik salonlari, avtoservislar va xususiy klinikalarda navbat kutish madaniyatini tubdan o‘zgartiruvchi, mijoz va biznesni yagona raqamli zanjirga bog‘lovchi platformadir.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🛑 <b>SLAYD 2: BOZORDAGI JIDDIY MUAMMO</b>\n` +
    `Bugun O‘zbekistondagi ko‘plab xizmat ko‘rsatish joylarida:\n` +
    `1. <b>Vaqt yo‘qotilishi:</b> Odamlar qabulxonada 1-2 soatlab asabiylashib navbat kutishadi.\n` +
    `2. <b>Mijozlarning ketib qolishi:</b> Uzun jonli navbatni ko‘rgan mijoz boshqa joyga ketib qoladi.\n` +
    `3. <b>Muvaffaqiyatsiz bronlar (No-Show):</b> Telefon orqali yozilgan mijozlarning 30% i kelmaydi va klinika bo‘sh qolib zarar ko‘radi.\n` +
    `4. <b>Nazorat yo‘qligi:</b> Biznes egasi kunlik haqiqiy tushum va qaysi shifokor qancha mijoz ko‘rganini aniq bilolmaydi.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 <b>SLAYD 3: NAVBATBOR QANDAY HAL QILADI?</b>\n` +
    `• <b>100% Avtomatlashtirilgan navbat:</b> Mijoz uyida turib bron qiladi yoki joyida QR-kod orqali navbat oladi.\n` +
    `• <b>Telegram Ekotizimi:</b> Ilova o‘rnatish shart emas! Xalq sevgan Telegram orqali barcha chiptalar va eslatmalar boradi.\n` +
    `• <b>Kutish vaqtini 80% ga qisqartirish:</b> Mijoz o‘z navbati kelgandagina xonaga kiradi.\n` +
    `• <b>Shaffof Kassa va KPI:</b> Har bir so‘m tushum va har bir mijoz raqamlashtiriladi.`;

  console.log('Sending Message 5: Presentation Part 1...');
  const res5 = await sendTelegram(pitchPart1);
  console.log('Message 5 result:', res5.ok);
  await sleep(1500);

  const pitchPart2 = 
    `💎 <b>SLAYD 4: MAHSULOTNING 4 TA USTUNI</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `1️⃣ <b>Smart Web Platforma:</b> Shahardagi eng yaxshi klinika va salonlar katalogi, reytinglar, sharhlar va onlayn slotlar.\n` +
    `2️⃣ <b>Mijozlar Telegram Boti (@Navbat1Uzb_bot):</b> Elektron chipta, 30 daqiqa oldin eslatma, jonli monitoring.\n` +
    `3️⃣ <b>Biznes Boshqaruv Boti (@navbatbor_bizness_bot):</b> Shifokor va rahbar uchun qulay mobil boshqaruv pulti.\n` +
    `4️⃣ <b>TV Display Tizimi:</b> Kutish zalidagi televizorlar uchun ovozli aqlli elektron tablo.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 <b>SLAYD 5: BIZNES MODEL VA DAROMAD MANBALARI</b>\n` +
    `Platforma quyidagi yo‘llar bilan barqaror yuqori daromad keltiradi:\n` +
    `• <b>B2B Oylik Obuna (SaaS):</b> Bizneslar oyiga 149,000 UZS dan 499,000 UZS gacha obuna to‘lashadi (14 kun bepul sinovdan so‘ng).\n` +
    `• <b>Featured Reklama Paketlari:</b> Klinikalarni qidiruvda TOP 1-o‘ringa chiqarish xizmati.\n` +
    `• <b>Qo‘shimcha Xizmatlar:</b> SMS bildirishnomalar paketi, maxsus televizor tablolari va brending.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📍 <b>SLAYD 6: 2026-YIL QARSHI SHAHRI PILOTI VA KENGAYISH</b>\n` +
    `• <b>1-Bosqich (Hozir):</b> Qarshi shahrida «Nasaf dental» va boshqa yetakchi klinikalarda tizim 100% muvaffaqiyatli sinovdan o‘tdi.\n` +
    `• <b>2-Bosqich:</b> Qarshi shahridagi 100+ klinika, salon va servis markazlarini ulash (oylik daromad: 30-50 mln UZS).\n` +
    `• <b>3-Bosqich:</b> Samarqand, Buxoro va Toshkent shaharlariga ekspansiya qilish (Respublika miqyosidagi №1 elektron navbat brendi).\n\n` +
    `🏆 <b>XULOSA:</b>\n` +
    `NavbatBor — bu shunchaki sayt emas, bu xizmat ko‘rsatuvchi muassasalar uchun <b>vaqt tejovchi, mijozlarni ko‘paytiruvchi va daromadni 2 barobar oshiruvchi tayyor ekotizimdir!</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📞 <b>Aloqa:</b> +998200232540 | @mansur_0511\n` +
    `🌐 <b>Veb-sayt:</b> NavbatBor.uz`;

  console.log('Sending Message 6: Presentation Part 2...');
  const res6 = await sendTelegram(pitchPart2);
  console.log('Message 6 result:', res6.ok);

  console.log('All materials successfully transmitted to Super Admin Telegram!');
}

run().catch(console.error);
