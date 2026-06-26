# ระบบออกหนังสือรับรองการหักภาษี ณ ที่จ่าย

ชุดโครงการนี้ใช้ Next.js บน Vercel และ Supabase PostgreSQL สำหรับฐานข้อมูล

## ขั้นตอนติดตั้ง

1. สร้างโครงการใหม่ใน Supabase
2. เปิดเมนู SQL Editor
3. วางคำสั่งจากไฟล์ `database/schema.sql`
4. กด Run เพื่อสร้างตาราง ฟังก์ชันออกเลขเอกสาร และข้อมูลเริ่มต้น
5. สร้างโครงการใหม่บน Vercel หรือเชื่อม Git Repository
6. กำหนด Environment Variables ตามไฟล์ `.env.example`
7. Deploy โครงการ

## Environment Variables

```text
NEXT_PUBLIC_APP_NAME
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
APP_ACCESS_CODE
NEXT_PUBLIC_SITE_URL
```

หมายเหตุสำคัญ: `SUPABASE_SERVICE_ROLE_KEY` ต้องเก็บไว้ในฝั่ง Server เท่านั้น และต้องไม่ใส่ในโค้ดฝั่ง Browser

## การใช้งาน

1. เปิดหน้าเว็บหลัก
2. ระบุรหัสเข้าใช้งานระบบตามค่า `APP_ACCESS_CODE`
3. บันทึกข้อมูลผู้มีหน้าที่หักภาษี
4. บันทึกข้อมูลผู้ถูกหักภาษี
5. กำหนดผู้ลงนาม
6. จัดทำหนังสือรับรอง
7. ออกเลขหนังสือรับรอง
8. ตรวจสอบเอกสารจากลิงก์ตรวจสอบเอกสาร

## ระบบเลขที่เอกสาร

รูปแบบเลขที่เอกสารคือ

```text
WHT-2569-0001
```

การออกเลขทำผ่านฟังก์ชัน PostgreSQL `issue_certificate` โดยล็อกข้อมูลเลขรันในฐานข้อมูลก่อนเพิ่มเลขลำดับ เพื่อป้องกันเลขเอกสารซ้ำ
