# Stock Alert Events

บริการเบื้องหลังสำหรับติดตามแผนขายหุ้นสหรัฐ ดึงราคาปัจจุบันจาก Finnhub และส่งการแจ้งเตือนผ่าน Telegram เมื่อราคาถึงจุดทำกำไร จุดตัดขาดทุน หรือหลุด Trailing Stop โดยใช้ Supabase เก็บพอร์ตและประวัติการแจ้งเตือน

## ความสามารถหลัก

- อ่านหุ้นที่เปิดใช้แผนขายจากตาราง `portfolio_holdings`
- ดึงราคาล่าสุดของแต่ละ ticker จาก Finnhub พร้อม retry เมื่อเรียก API ไม่สำเร็จ
- รองรับการแจ้งเตือน `TAKE_PROFIT`, `STOP_LOSS` และ `TRAILING_STOP`
- รวมหลายรายการเป็นข้อความ Telegram เดียวต่อรอบ
- บันทึก event หลังส่งข้อความสำเร็จ เพื่อไม่แจ้งเงื่อนไขเดิมซ้ำ
- ป้องกัน cron รอบใหม่ทำงานซ้อนกับรอบที่ยังไม่เสร็จ
- มี dry run สำหรับตรวจเงื่อนไขโดยไม่ส่งข้อความหรือแก้ข้อมูล

## สิ่งที่ต้องมี

- Node.js 18 ขึ้นไป
- โปรเจกต์ Supabase ที่มีตาราง `portfolio_holdings`
- Finnhub API key
- Telegram bot token และ chat ID

แถวใน `portfolio_holdings` ที่ต้องการให้ระบบตรวจสอบควรมี `sell_plan_enabled = true`, `shares > 0`, `price_usd > 0` และกำหนดอย่างน้อยหนึ่งค่าใน `take_profit_pct`, `stop_loss_pct` หรือ `trailing_stop_pct` ให้มากกว่า 0

## เริ่มต้นใช้งาน

1. ติดตั้ง dependencies

   ```bash
   npm install
   ```

2. สร้างไฟล์ `.env` สำหรับ development หรือ `.env.prod` สำหรับ production

   ```dotenv
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   FINNHUB_API_KEY=your-finnhub-api-key
   TELEGRAM_BOT_TOKEN=your-telegram-bot-token
   TELEGRAM_CHAT_ID=your-telegram-chat-id
   CRON_TIMEZONE=Asia/Bangkok
   ```

   ห้าม commit ไฟล์ environment หรือเปิดเผย `SUPABASE_SERVICE_ROLE_KEY` และ token ต่าง ๆ

3. รัน SQL migration ตามลำดับผ่าน Supabase SQL Editor หรือระบบ migration ที่ใช้อยู่

   ```text
   migrations/001_create_stock_alert_events.sql
   migrations/002_add_stock_alert_events_rls_policy.sql
   ```

   Migration จะสร้างตาราง `stock_alert_events`, unique index สำหรับ `(holding_id, alert_type)` และ RLS policy ที่ปิดกั้น client roles ตารางนี้ออกแบบให้ backend ที่ใช้ service role เป็นผู้จัดการเท่านั้น

4. ทดสอบการเชื่อมต่อ Telegram

   ```bash
   npm run test:telegram
   ```

5. ทดลองประเมิน alert โดยไม่แก้ฐานข้อมูลและไม่ส่ง Telegram

   ```bash
   npm run run:dry
   ```

6. เริ่ม cron service

   ```bash
   npm run dev
   ```

## คำสั่งที่ใช้บ่อย

| คำสั่ง | รายละเอียด |
| --- | --- |
| `npm run dev` | เริ่ม cron service ด้วย TypeScript |
| `npm run run:once` | ประมวลผลหนึ่งรอบ ส่ง Telegram และบันทึก event ตามจริง |
| `npm run run:dry` | ประมวลผลหนึ่งรอบโดยไม่ส่งข้อความและไม่แก้ฐานข้อมูล |
| `npm run test:telegram` | ส่งข้อความทดสอบไปยัง Telegram |
| `npm run typecheck` | ตรวจ TypeScript โดยไม่สร้างไฟล์ output |
| `npm run build` | compile TypeScript ไปยัง `dist/` |
| `npm start` | รันไฟล์ที่ build แล้วในโหมด production |

ตัวอย่างการรัน production:

```bash
npm run build
npm start
```

เมื่อ `NODE_ENV=production` ระบบจะเลือกไฟล์ environment ตามลำดับ `.env.prod`, `.env.production`, `.env` ส่วน development จะเลือก `.env.local`, `.env`

## ตารางเวลา Cron

Cron ทำงานตามค่า `CRON_TIMEZONE` ซึ่งมีค่าเริ่มต้นเป็น `Asia/Bangkok`:

| เวลา | วันที่ |
| --- | --- |
| 20:30, 20:40, 20:50 | จันทร์–ศุกร์ |
| ทุก 10 นาที เวลา 21:00–23:50 | จันทร์–ศุกร์ |
| ทุก 10 นาที เวลา 00:00–01:50 | อังคาร–เสาร์ |
| 02:00 | อังคาร–เสาร์ |

ตารางนี้ครอบคลุมช่วงค่ำต่อเนื่องถึงเช้าวันถัดไป หากเปลี่ยน timezone เวลาทำงานจะอ้างอิง timezone ใหม่ แต่ cron expression จะไม่เปลี่ยนตามเวลาตลาดโดยอัตโนมัติ

## หลักการแจ้งเตือน

- **Take Profit** — แจ้งเมื่อเปอร์เซ็นต์กำไรมากกว่าหรือเท่ากับ `take_profit_pct`
- **Stop Loss** — แจ้งเมื่อเปอร์เซ็นต์ขาดทุนมากกว่าหรือเท่ากับ `stop_loss_pct`
- **Trailing Stop** — ติดตาม `peak_profit_pct` แล้วแจ้งเมื่อกำไรลดลงจากจุดสูงสุดอย่างน้อย `trailing_stop_pct`

หากหุ้นหนึ่งตัวเข้าเงื่อนไขหลายแบบในรอบเดียว ระบบจะเลือกเพียงรายการเดียวตามลำดับความสำคัญ: Stop Loss → Trailing Stop → Take Profit

หนึ่ง holding จะถูกแจ้งเพียงครั้งเดียวต่อประเภท alert ตาม unique index ใน `stock_alert_events` หากต้องการเริ่มรอบการแจ้งเตือนใหม่หลังปรับแผนขาย ต้องลบ event เดิมของ holding/ประเภทนั้นด้วยกระบวนการที่ควบคุมสิทธิ์อย่างเหมาะสม

## โครงสร้างโปรเจกต์

```text
src/
├── config/       # ตรวจสอบและโหลด environment variables
├── jobs/         # cron schedule และ workflow การประมวลผล
├── lib/          # Supabase client และ logger
├── services/     # alert engine, Finnhub, holdings และ Telegram
├── types/        # TypeScript types ของ holding และ alert event
├── utils/        # ตัวช่วย format วันที่ ตัวเลข และ HTML
└── index.ts      # entry point และ CLI commands
migrations/       # SQL สำหรับตาราง event และ RLS
```

ลำดับการทำงานหลักคือ อ่าน holdings → ดึงราคา → ประเมินเงื่อนไข → รวมข้อความ → ส่ง Telegram → บันทึก events โดยจะบันทึก event เฉพาะเมื่อส่ง Telegram สำเร็จแล้ว

## หมายเหตุด้านความปลอดภัย

- ใช้ `SUPABASE_SERVICE_ROLE_KEY` เฉพาะใน backend ที่เชื่อถือได้เท่านั้น เพราะ key นี้ข้าม RLS ได้
- อย่านำ service นี้หรือ environment variables ไปฝังใน frontend
- ตาราง `stock_alert_events` ปฏิเสธการเข้าถึงจาก Supabase roles `anon` และ `authenticated`
- ควรเก็บ secrets ใน secret manager ของระบบ deploy แทนการวางไฟล์ `.env.prod` บน repository
