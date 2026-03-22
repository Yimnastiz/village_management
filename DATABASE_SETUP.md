# Database Setup (PostgreSQL + Prisma)

เอกสารนี้อธิบายการติดตั้งและตั้งค่า database สำหรับโปรเจคนี้แบบ local development

## 1) สิ่งที่ต้องมี

- Node.js + npm
- Docker Desktop (Windows/macOS) หรือ Docker Engine (Linux)

ตรวจสอบเวอร์ชัน:

```bash
node -v
npm -v
docker -v
```

## 2) ตั้งค่าไฟล์ `.env`

โปรเจคนี้เตรียมไฟล์ `.env` ให้แล้วที่ root:

```env
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
BETTER_AUTH_SECRET="(secret)"
DATABASE_URL="postgresql://village_user:village_password@localhost:55432/village_management?schema=public"
```

ถ้าต้องการเปลี่ยน user/password/db name ให้แก้ทั้ง `.env` และคำสั่ง `docker run` ให้ตรงกัน

## 3) สร้าง PostgreSQL image จาก Dockerfile

```bash
docker build -f docker/postgres/Dockerfile -t village-postgres:local .
```

## 4) รัน PostgreSQL container

```bash
docker run -d `
  --name village-postgres `
  -p 55432:5432 `
  -e POSTGRES_USER=village_user `
  -e POSTGRES_PASSWORD=village_password `
  -e POSTGRES_DB=village_management `
  -v village_pgdata:/var/lib/postgresql/data `
  village-postgres:local
```

ตรวจสอบสถานะ:

```bash
docker ps
docker logs village-postgres
```

## 5) เตรียม Prisma schema และ migration

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
```

ตัวเลือกกรณีไม่อยากสร้าง migration ไฟล์ (เฉพาะ dev):

```bash
npx prisma db push
```

## 6) รันแอป

```bash
npm run dev
```

จากนั้นเปิด:

- App: http://localhost:3000

## 7) คำสั่งจัดการฐานข้อมูลที่ใช้บ่อย

เริ่ม/หยุด container:

```bash
docker start village-postgres
docker stop village-postgres
```

เข้า psql ใน container:

```bash
docker exec -it village-postgres psql -U village_user -d village_management
```

ลบ container (ข้อมูลยังอยู่ใน volume):

```bash
docker rm -f village-postgres
```

ลบข้อมูลทั้งหมดของ DB (ระวังข้อมูลหาย):

```bash
docker volume rm village_pgdata
```

เปิด Prisma Studio:

```bash
npx prisma studio
```

## 8) ปัญหาที่พบบ่อย

- Port `55432` ชน: เปลี่ยนฝั่ง host เป็น `-p 55433:5432` แล้วแก้ `DATABASE_URL` ให้เป็น `localhost:55433`
- ต่อ DB ไม่ได้: เช็ก `docker ps` และดู log ด้วย `docker logs village-postgres`
- ใช้แอปใน Docker network: host ใน `DATABASE_URL` ต้องเป็นชื่อ container/service แทน `localhost`

## 9) Dev Role Flow (new)

- `DEV_BOOTSTRAP_PHONE` in `.env` can auto-promote one phone number to `SUPERADMIN` after login.
- Login with that phone, then open `http://localhost:3000/dev`.
- In `/dev`:
  - add village source data (province/district/subdistrict/village)
  - seed role by phone (for example, set headman phone to `HEADMAN`)
  - manage existing users and membership roles
- Signup now requires location dropdowns from village source data.
- After OTP verify, system checks phone seed and routes user by role automatically.
