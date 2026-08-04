This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Village Catalog

See “นำเข้ารายชื่อหมู่บ้านประเทศไทย” below. The Super Admin Catalog reads ThailandVillageMaster; it does not create operational Village records until a Super Admin explicitly selects and activates one.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## นำเข้ารายชื่อหมู่บ้านประเทศไทย

Catalog นี้เป็นรายชื่อและที่ตั้งหมู่บ้านอ้างอิง ไม่ใช่เลขบ้านรายหลังหรือรายชื่อประชาชน ข้อมูลจะเข้า ThailandVillageMaster เท่านั้น และจะยังไม่สร้าง Village ที่ใช้งานจริงจนกว่า Super Admin จะเลือกและกดเปิดใช้งาน

1. ดาวน์โหลดไฟล์ JSON จาก data.go.th / Government Data Catalog ชุด “ข้อมูลที่ตั้งและสภาพทั่วไปของหมู่บ้านใน 76 จังหวัด”
2. วางไฟล์ JSON ดิบทุกจังหวัดไว้ใน data/raw/gdcatalog-villages/ โดยไม่ต้องแก้ field ในไฟล์
3. รัน npm run catalog:setup

หรือรัน npm run catalog:prepare, npm run catalog:import, npm run catalog:status แยกกัน ไฟล์ที่ผ่านการคัด field แล้วจะอยู่ที่ data/processed/thailand-villages.json จากนั้นเปิด /superadmin/villages กดเพิ่มหมู่บ้าน เลือกจังหวัด → อำเภอ → ตำบล แล้วเลือกหมู่บ้านจาก Catalog เพื่อสร้าง Village จริง

สำหรับทดสอบโดยไม่ใช้ไฟล์รัฐ: npm run catalog:import:demo
