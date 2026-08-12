# วิธีติดตั้ง Village Management System

เอกสารนี้สำหรับเพื่อนหรืออาจารย์ที่เพิ่ง clone โปรเจกต์บน Windows PowerShell

## สิ่งที่ต้องมี

- Node.js 20.9 ขึ้นไป
- Docker Desktop ที่เปิดอยู่
- Git

## วิธีติดตั้งแบบสั้น

```powershell
git clone <repo-url>
cd village_management
npm install
npm run db:up
npm run setup
npm run dev
```

จากนั้นเปิด [http://localhost:3000](http://localhost:3000)

`npm run db:up` จะสร้าง PostgreSQL local ผ่าน Docker Compose ที่ port `55432` และ `npm run setup` จะสร้าง `.env` จาก `.env.example` ให้อัตโนมัติเมื่อยังไม่มีไฟล์

## การเข้าถึง Super Admin

Super Admin เป็นผู้ดำเนินการระดับระบบจาก ENV ไม่ใช่บัญชี Better Auth และไม่ต้องมีชื่อ เบอร์โทร อีเมล หรือ OTP

1. สร้างไฟล์ `.env.local` (ไม่ commit) และตั้งค่าสำหรับ Development เช่น
   ```env
   SUPERADMIN_ACCESS_CODE="123456"
   SUPERADMIN_SESSION_SECRET="dev-superadmin-session-secret-change-this"
   ```
2. หลังแก้ `.env.local` ให้ restart server เสมอ เพราะ Fast Refresh ไม่ควรใช้คาดหวังการ reload ENV ฝั่ง Server:
   ```bash
   Ctrl + C
   npm run dev
   ```
3. เปิด `http://localhost:3000/superadmin` แล้วกรอกรหัส

รายละเอียดเพิ่มเติมอยู่ที่ [SUPERADMIN_ACCESS.md](SUPERADMIN_ACCESS.md)

## `npm run setup` ทำอะไรบ้าง

1. ตรวจเวอร์ชัน Node.js และไฟล์ `.env`
2. ตรวจว่า PostgreSQL เชื่อมต่อได้
3. รัน Prisma generate และ `prisma migrate deploy`
4. รัน seed เดิมของโปรเจกต์เมื่อมี (เวอร์ชันปัจจุบันยังไม่มี seed script)
5. นำเข้าข้อมูล Thailand Village Catalog และตรวจสถานะ

การรัน `npm run setup` ซ้ำปลอดภัย: ถ้ามี Catalog ฉบับเต็มในฐานข้อมูลแล้ว จะข้ามการนำเข้าซ้ำ เพื่อไม่ให้เสียเวลานาน

## ใช้ PostgreSQL ที่มีอยู่แล้ว

สร้าง `.env` โดยคัดลอกจาก `.env.example` แล้วแก้ `DATABASE_URL` ให้ชี้ไปยัง PostgreSQL ของคุณ จากนั้นรัน:

```powershell
npm install
npm run setup
npm run dev
```

ไม่ต้องรัน `npm run db:up` หากไม่ได้ใช้ฐานข้อมูล Docker ของโปรเจกต์

## ข้อมูลหมู่บ้าน

ระบบเลือกแหล่งข้อมูลตามลำดับนี้:

1. `data/processed/thailand-villages.json` — นำเข้าได้ทันที
2. JSON ดิบใน `data/raw/gdcatalog-villages/` — ระบบจะเตรียมเป็น processed แล้วนำเข้า
3. `data/demo/thailand-villages.demo.json` — ใช้เฉพาะข้อมูลทดลองเมื่อไม่มีข้อมูลฉบับเต็ม

หลังติดตั้ง ตรวจจำนวนข้อมูลได้ด้วย:

```powershell
npm run catalog:status
```

ถ้าเป็นข้อมูลฉบับเต็ม จำนวนควรมีอย่างน้อยหลายหมื่นรายการ แล้วเปิดหน้า `/superadmin/villages` เพื่อค้นหาและเลือกหมู่บ้านจาก Catalog

คำสั่ง Catalog เดิมยังใช้ได้:

```powershell
npm run catalog:prepare
npm run catalog:import
npm run catalog:status
npm run catalog:setup
```

## คำสั่งฐานข้อมูลที่ใช้บ่อย

```powershell
npm run db:up       # เปิด PostgreSQL
npm run db:down     # หยุดและลบ container (เก็บข้อมูลใน volume)
npm run db:reset    # ล้างข้อมูล local ทั้งหมดแล้วเริ่มใหม่
npm run setup:db    # ตรวจ DB, Prisma generate, migrations และ seed โดยไม่ import Catalog
```

`db:reset` ลบข้อมูล PostgreSQL local ใน Docker volume; อย่าใช้กับข้อมูลที่ต้องเก็บไว้

## แก้ปัญหาเบื้องต้น

- เชื่อมต่อ PostgreSQL ไม่ได้: เปิด Docker Desktop แล้วรัน `npm run db:up` ก่อน
- Port `55432` ถูกใช้: เปลี่ยน port ใน `docker-compose.yml` และ `DATABASE_URL` ใน `.env` ให้ตรงกัน
- ไม่มีข้อมูลหมู่บ้าน: วาง JSON ดิบใน `data/raw/gdcatalog-villages/` หรือใส่ `data/processed/thailand-villages.json` แล้วรัน `npm run setup` อีกครั้ง
- ต้องการรายละเอียด Docker/Prisma เพิ่มเติม: ดู [DATABASE_SETUP.md](DATABASE_SETUP.md)
