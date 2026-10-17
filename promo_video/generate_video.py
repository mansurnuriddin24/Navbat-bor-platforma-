import os
import subprocess
from PIL import Image, ImageDraw, ImageFont

WIDTH = 1080
HEIGHT = 1920
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

def get_font(size, bold=False):
    # Try Windows system fonts
    font_names = ["segoeui.ttf", "arial.ttf", "calibri.ttf"]
    if bold:
        font_names = ["segoeuib.ttf", "arialbd.ttf", "calibrib.ttf"]
    
    font_dir = "C:\\Windows\\Fonts"
    for name in font_names:
        p = os.path.join(font_dir, name)
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except:
                pass
    return ImageFont.load_default()

def draw_gradient(draw, width, height, top_color, bottom_color):
    r1, g1, b1 = top_color
    r2, g2, b2 = bottom_color
    for y in range(height):
        ratio = y / height
        r = int(r1 + (r2 - r1) * ratio)
        g = int(g1 + (g2 - g1) * ratio)
        b = int(b1 + (b2 - b1) * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b))

def draw_rounded_card(draw, box, fill, outline=None, width=1, radius=24):
    x1, y1, x2, y2 = box
    draw.rounded_rectangle([x1, y1, x2, y2], radius=radius, fill=fill, outline=outline, width=width)

def render_slide_1():
    img = Image.new("RGB", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(img)
    draw_gradient(draw, WIDTH, HEIGHT, (15, 23, 42), (30, 27, 75))

    # Header Logo / Brand
    f_logo = get_font(52, bold=True)
    draw.text((WIDTH // 2, 140), "NAVBATBOR.UZ", fill=(96, 165, 250), font=f_logo, anchor="mm")

    # Alert Badge
    f_badge = get_font(32, bold=True)
    draw_rounded_card(draw, (WIDTH//2 - 280, 220, WIDTH//2 + 280, 290), fill=(225, 29, 72, 200), radius=35)
    draw.text((WIDTH // 2, 255), "❌ SALONLARDA KATTA MUAMMO", fill=(255, 255, 255), font=f_badge, anchor="mm")

    # Headline
    f_title = get_font(64, bold=True)
    draw.text((WIDTH // 2, 390), "Mijozlaringiz kutishdan", fill=(255, 255, 255), font=f_title, anchor="mm")
    draw.text((WIDTH // 2, 470), "zerikib ketib qolyaptimi?", fill=(244, 63, 94), font=f_title, anchor="mm")

    # Card 1: Calls
    draw_rounded_card(draw, (80, 580, WIDTH - 80, 780), fill=(30, 41, 59), outline=(71, 85, 105), width=2, radius=28)
    f_card_t = get_font(44, bold=True)
    f_card_d = get_font(32)
    draw.text((130, 640), "📞 Tinimsiz telefon qo'ng'iroqlari", fill=(255, 255, 255), font=f_card_t)
    draw.text((130, 705), "Har bir mijozga vaqt ajratish va adashishlar", fill=(148, 163, 184), font=f_card_d)

    # Card 2: Queue chaos
    draw_rounded_card(draw, (80, 820, WIDTH - 80, 1020), fill=(30, 41, 59), outline=(71, 85, 105), width=2, radius=28)
    draw.text((130, 880), "⏳ Kutish zalidagi tiqilinch", fill=(255, 255, 255), font=f_card_t)
    draw.text((130, 945), "Mijozlar asabiylashib, boshqa joyga ketishi", fill=(148, 163, 184), font=f_card_d)

    # Card 3: Lost Revenue
    draw_rounded_card(draw, (80, 1060, WIDTH - 80, 1260), fill=(30, 41, 59), outline=(71, 85, 105), width=2, radius=28)
    draw.text((130, 1120), "💸 Bo'sh qolgan oyna va soatlar", fill=(255, 255, 255), font=f_card_t)
    draw.text((130, 1185), "Hisob-kitobsiz qolgan kunlik yo'qotishlar", fill=(148, 163, 184), font=f_card_d)

    # Subtitle bar at bottom
    f_sub = get_font(36, bold=True)
    draw_rounded_card(draw, (120, 1420, WIDTH - 120, 1540), fill=(244, 63, 94), radius=28)
    draw.text((WIDTH // 2, 1480), "Bunga chek qo'yish vaqti keldi!", fill=(255, 255, 255), font=f_sub, anchor="mm")

    path = os.path.join(OUTPUT_DIR, "slide1.png")
    img.save(path)
    return path

def render_slide_2():
    img = Image.new("RGB", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(img)
    draw_gradient(draw, WIDTH, HEIGHT, (10, 25, 47), (37, 99, 235))

    # Header Logo / Brand
    f_logo = get_font(52, bold=True)
    draw.text((WIDTH // 2, 140), "NAVBATBOR.UZ", fill=(147, 197, 253), font=f_logo, anchor="mm")

    # Solution Badge
    f_badge = get_font(32, bold=True)
    draw_rounded_card(draw, (WIDTH//2 - 240, 220, WIDTH//2 + 240, 290), fill=(16, 185, 129), radius=35)
    draw.text((WIDTH // 2, 255), "✨ ZAMONAVIY YECHIM", fill=(255, 255, 255), font=f_badge, anchor="mm")

    # Headline
    f_title = get_font(60, bold=True)
    draw.text((WIDTH // 2, 380), "Sartaroshxona va Salonlar", fill=(255, 255, 255), font=f_title, anchor="mm")
    draw.text((WIDTH // 2, 460), "Uchun Yagona Tizim!", fill=(250, 204, 21), font=f_title, anchor="mm")

    f_sub = get_font(36)
    draw.text((WIDTH // 2, 535), "Jonli navbat & Onlayn bronlash platformasi", fill=(224, 231, 255), font=f_sub, anchor="mm")

    # Card 1: Telegram Bot
    draw_rounded_card(draw, (80, 630, WIDTH - 80, 830), fill=(15, 23, 42), outline=(59, 130, 246), width=2, radius=28)
    f_card_t = get_font(42, bold=True)
    f_card_d = get_font(30)
    draw.text((130, 680), "🤖 Telegram Bot Orqali Band Qilish", fill=(255, 255, 255), font=f_card_t)
    draw.text((130, 745), "Mijozlar botdan 10 soniyada navbat oladi", fill=(148, 163, 184), font=f_card_d)

    # Card 2: QR Stand
    draw_rounded_card(draw, (80, 870, WIDTH - 80, 1070), fill=(15, 23, 42), outline=(59, 130, 246), width=2, radius=28)
    draw.text((130, 920), "📲 QR-Kodli Elektron Stend", fill=(255, 255, 255), font=f_card_t)
    draw.text((130, 985), "Eshikdagi QR-kodni skanerlab navbatga turishadi", fill=(148, 163, 184), font=f_card_d)

    # Card 3: Automatic Reminders
    draw_rounded_card(draw, (80, 1110, WIDTH - 80, 1310), fill=(15, 23, 42), outline=(59, 130, 246), width=2, radius=28)
    draw.text((130, 1160), "🔔 Avtomatik Eslatmalar", fill=(255, 255, 255), font=f_card_t)
    draw.text((130, 1225), "Mijozlarga o'z vaqtida kelish xabarnomasi", fill=(148, 163, 184), font=f_card_d)

    # Footer Highlight
    draw_rounded_card(draw, (100, 1420, WIDTH - 100, 1540), fill=(30, 58, 138), outline=(96, 165, 250), width=2, radius=28)
    f_hl = get_font(36, bold=True)
    draw.text((WIDTH // 2, 1480), "⚡️ 2 daqiqada oson ishga tushirish!", fill=(255, 255, 255), font=f_hl, anchor="mm")

    path = os.path.join(OUTPUT_DIR, "slide2.png")
    img.save(path)
    return path

def render_slide_3():
    img = Image.new("RGB", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(img)
    draw_gradient(draw, WIDTH, HEIGHT, (6, 78, 59), (15, 23, 42))

    # Header Logo / Brand
    f_logo = get_font(52, bold=True)
    draw.text((WIDTH // 2, 140), "NAVBATBOR.UZ", fill=(110, 231, 183), font=f_logo, anchor="mm")

    # Benefits Badge
    f_badge = get_font(32, bold=True)
    draw_rounded_card(draw, (WIDTH//2 - 250, 220, WIDTH//2 + 250, 290), fill=(5, 150, 105), radius=35)
    draw.text((WIDTH // 2, 255), "🚀 BIZNES UCHUN FOYDALAR", fill=(255, 255, 255), font=f_badge, anchor="mm")

    # Massive metric
    f_metric = get_font(130, bold=True)
    draw.text((WIDTH // 2, 430), "+30%", fill=(52, 211, 153), font=f_metric, anchor="mm")
    f_metric_lbl = get_font(42, bold=True)
    draw.text((WIDTH // 2, 530), "Sof daromad va tushum o'sishi!", fill=(255, 255, 255), font=f_metric_lbl, anchor="mm")

    # Card 1: Time
    draw_rounded_card(draw, (80, 640, WIDTH - 80, 840), fill=(20, 83, 45, 180), outline=(52, 211, 153), width=2, radius=28)
    f_card_t = get_font(42, bold=True)
    f_card_d = get_font(30)
    draw.text((130, 690), "✅ Mijozlar O'z Vaqtida Keladi", fill=(255, 255, 255), font=f_card_t)
    draw.text((130, 755), "Kutish zalida tiqilinch yo'q, xodimlar tartibli ishlaydi", fill=(167, 243, 208), font=f_card_d)

    # Card 2: 100% capacity
    draw_rounded_card(draw, (80, 880, WIDTH - 80, 1080), fill=(20, 83, 45, 180), outline=(52, 211, 153), width=2, radius=28)
    draw.text((130, 930), "✅ Bo'sh Oynalar To'liq To'ladi", fill=(255, 255, 255), font=f_card_t)
    draw.text((130, 995), "Kunlik jadval maksimal quvvat bilan ishlaydi", fill=(167, 243, 208), font=f_card_d)

    # Card 3: Loyalty
    draw_rounded_card(draw, (80, 1120, WIDTH - 80, 1320), fill=(20, 83, 45, 180), outline=(52, 211, 153), width=2, radius=28)
    draw.text((130, 1170), "✅ Doimiy Mamnun Mijozlar", fill=(255, 255, 255), font=f_card_t)
    draw.text((130, 1235), "Zamonaviy servis tufayli mijozlar doim qaytib keladi", fill=(167, 243, 208), font=f_card_d)

    # Bottom Pill
    draw_rounded_card(draw, (100, 1420, WIDTH - 100, 1540), fill=(16, 185, 129), radius=28)
    f_hl = get_font(36, bold=True)
    draw.text((WIDTH // 2, 1480), "Professional xizmat — yuqori natija!", fill=(255, 255, 255), font=f_hl, anchor="mm")

    path = os.path.join(OUTPUT_DIR, "slide3.png")
    img.save(path)
    return path

def render_slide_4():
    img = Image.new("RGB", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(img)
    draw_gradient(draw, WIDTH, HEIGHT, (30, 27, 75), (29, 78, 216))

    # Header Logo / Brand
    f_logo = get_font(52, bold=True)
    draw.text((WIDTH // 2, 140), "NAVBATBOR.UZ", fill=(147, 197, 253), font=f_logo, anchor="mm")

    # Action Badge
    f_badge = get_font(32, bold=True)
    draw_rounded_card(draw, (WIDTH//2 - 230, 220, WIDTH//2 + 230, 290), fill=(245, 158, 11), radius=35)
    draw.text((WIDTH // 2, 255), "🎁 MAXSUS TAKLIF", fill=(255, 255, 255), font=f_badge, anchor="mm")

    # Big Offer Box
    draw_rounded_card(draw, (80, 360, WIDTH - 80, 720), fill=(255, 255, 255), radius=36)
    f_offer_t = get_font(56, bold=True)
    draw.text((WIDTH // 2, 450), "14 KUN BEPUL", fill=(30, 58, 138), font=f_offer_t, anchor="mm")
    draw.text((WIDTH // 2, 530), "SINOV MUDDATI!", fill=(37, 99, 235), font=f_offer_t, anchor="mm")

    f_offer_d = get_font(32)
    draw.text((WIDTH // 2, 630), "Hech qanday to'lovsiz barcha funksiyalarni sinab ko'ring", fill=(71, 85, 105), font=f_offer_d, anchor="mm")

    # Ways to connect
    draw_rounded_card(draw, (80, 770, WIDTH - 80, 970), fill=(15, 23, 42), outline=(147, 197, 253), width=2, radius=28)
    f_box_t = get_font(40, bold=True)
    f_box_d = get_font(34, bold=True)
    draw.text((130, 820), "🌐 Rasmiy saytimiz:", fill=(148, 163, 184), font=f_box_t)
    draw.text((130, 890), "www.navbatbor.uz", fill=(96, 165, 250), font=f_box_d)

    draw_rounded_card(draw, (80, 1010, WIDTH - 80, 1210), fill=(15, 23, 42), outline=(147, 197, 253), width=2, radius=28)
    draw.text((130, 1060), "🤖 Telegram Biznes Botimiz:", fill=(148, 163, 184), font=f_box_t)
    draw.text((130, 1130), "@navbatbor_bizness_bot", fill=(52, 211, 153), font=f_box_d)

    # Call To Action Button
    draw_rounded_card(draw, (80, 1340, WIDTH - 80, 1500), fill=(245, 158, 11), radius=35)
    f_cta = get_font(44, bold=True)
    draw.text((WIDTH // 2, 1420), "Hoziroq Ro'yxatdan O'ting! 👆", fill=(17, 24, 39), font=f_cta, anchor="mm")

    f_tag = get_font(30)
    draw.text((WIDTH // 2, 1550), "O'zbekistondagi eng qulay onlayn navbat platformasi", fill=(203, 213, 225), font=f_tag, anchor="mm")

    path = os.path.join(OUTPUT_DIR, "slide4.png")
    img.save(path)
    return path

def build_video():
    print("Generating slides...")
    s1 = render_slide_1()
    s2 = render_slide_2()
    s3 = render_slide_3()
    s4 = render_slide_4()
    print("Slides created successfully.")

    # Slides timing matching voiceover exactly:
    # 0.0 - 6.6s: Slide 1 (Problem)
    # 6.6 - 14.4s: Slide 2 (Solution)
    # 14.4 - 19.2s: Slide 3 (Benefits)
    # 19.2 - 25.0s: Slide 4 (Call to Action)
    audio_path = os.path.join(OUTPUT_DIR, "voiceover.mp3")
    output_video = os.path.join(OUTPUT_DIR, "navbatbor_promo_commercial.mp4")

    # FFmpeg concat filter script
    # Slide 1: 6.6s, Slide 2: 7.8s, Slide 3: 4.8s, Slide 4: 5.8s -> Total = 25.0s
    cmd = [
        "ffmpeg", "-y",
        "-loop", "1", "-t", "6.6", "-i", s1,
        "-loop", "1", "-t", "7.8", "-i", s2,
        "-loop", "1", "-t", "4.8", "-i", s3,
        "-loop", "1", "-t", "5.8", "-i", s4,
        "-i", audio_path,
        "-filter_complex",
        "[0:v][1:v][2:v][3:v]concat=n=4:v=1:a=0[v]",
        "-map", "[v]",
        "-map", "4:a",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "22",
        "-pix_fmt", "yuv420p",
        "-r", "30",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        output_video
    ]
    print("Running FFmpeg composition...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0:
        print(f"🎉 Commercial video successfully created: {output_video}")
    else:
        print("FFmpeg error:", res.stderr)

if __name__ == "__main__":
    build_video()
