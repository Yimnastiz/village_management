# Database Setup (PostgreSQL + Prisma)

สำหรับการพัฒนา local ให้ใช้ Docker Compose ที่ root ของโปรเจกต์:

```powershell
npm install
npm run db:up
npm run setup
```

ค่ามาตรฐานอยู่ใน `.env.example`:

```env
DATABASE_URL="postgresql://village_user:village_password@localhost:55432/village_management?schema=public"
```

`npm run setup` ใช้ `npx prisma migrate deploy` เพราะ repository นี้มี migrations ที่ต้องใช้ร่วมกันอยู่ใน `prisma/migrations/` แล้วจึงรัน Prisma generate และนำเข้าข้อมูล Catalog

## คำสั่ง Docker fallback

หาก Docker Compose ใช้ไม่ได้ สามารถใช้ Dockerfile เดิมได้:

```powershell
docker build -f docker/postgres/Dockerfile -t village-postgres:local .
docker run -d --name village-postgres -p 55432:5432 -e POSTGRES_USER=village_user -e POSTGRES_PASSWORD=village_password -e POSTGRES_DB=village_management -v village_postgres_data:/var/lib/postgresql/data village-postgres:local
```

จากนั้นรัน `npm run setup`

## คำสั่งที่ใช้บ่อย

```powershell
npm run db:up
npm run db:down
npm run db:reset
npm run setup:db
npm run catalog:status
```

`npm run db:reset` จะลบ Docker volume `village_postgres_data` และข้อมูล local ทั้งหมด
