import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { Client } from "pg";

const projectRoot = path.resolve(import.meta.dirname, "..");
const envPath = path.join(projectRoot, ".env");
const envExamplePath = path.join(projectRoot, ".env.example");
const processedCatalogPath = path.join(projectRoot, "data", "processed", "thailand-villages.json");
const rawCatalogDirectory = path.join(projectRoot, "data", "raw", "gdcatalog-villages");
const demoCatalogPath = path.join(projectRoot, "data", "demo", "thailand-villages.demo.json");
const databaseOnly = process.argv.includes("--database-only");

function commandName(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function run(command, args, label) {
  return new Promise((resolve, reject) => {
    // Windows cannot spawn .cmd shims (such as npx.cmd) directly with shell: false.
    const usesWindowsCmdShim = process.platform === "win32" && command.toLowerCase().endsWith(".cmd");
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: process.env,
      stdio: "inherit",
      shell: usesWindowsCmdShim,
    });
    child.on("error", (error) => reject(new Error(`${label} เริ่มทำงานไม่ได้: ${error.message}`)));
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} ไม่สำเร็จ${signal ? ` (${signal})` : ` (exit code ${code})`}`));
    });
  });
}

function readEnvValue(content, key) {
  const line = content.split(/\r?\n/u).find((item) => item.trimStart().startsWith(`${key}=`));
  if (!line) return undefined;
  let value = line.slice(line.indexOf("=") + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureEnvironmentFile() {
  if (!(await exists(envPath))) {
    if (!(await exists(envExamplePath))) {
      throw new Error("ไม่พบ .env และ .env.example จึงยังตั้งค่า DATABASE_URL ให้ไม่ได้");
    }
    await fs.copyFile(envExamplePath, envPath);
    console.log("สร้าง .env จาก .env.example แล้ว (ใช้ค่า local development เริ่มต้น)");
    console.log("โปรดตรวจค่า DATABASE_URL ใน .env หากคุณใช้ PostgreSQL ที่ไม่ได้รันจาก npm run db:up");
  }

  const envContent = await fs.readFile(envPath, "utf8");
  const databaseUrl = process.env.DATABASE_URL || readEnvValue(envContent, "DATABASE_URL");
  if (!databaseUrl) {
    throw new Error("ไม่พบ DATABASE_URL ใน .env\nตั้งค่า DATABASE_URL แล้วรัน npm run setup อีกครั้ง");
  }
  process.env.DATABASE_URL = databaseUrl;
}

async function checkDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    await client.query("SELECT 1");
  } catch (error) {
    throw new Error(
      "เชื่อมต่อ PostgreSQL ไม่ได้\n" +
        "กรุณาเปิด Docker Desktop แล้วรัน: npm run db:up\n" +
        "หรือเปิด PostgreSQL ตาม DATABASE_URL ใน .env แล้วรัน npm run setup อีกครั้ง\n" +
        `รายละเอียด: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function getSeedCommand() {
  const packageJson = JSON.parse(await fs.readFile(path.join(projectRoot, "package.json"), "utf8"));
  if (packageJson.prisma?.seed) {
    return { command: commandName("npx"), args: ["prisma", "db", "seed"], label: "Prisma seed" };
  }
  if (packageJson.scripts?.seed) {
    return { command: commandName("npm"), args: ["run", "seed"], label: "seed script" };
  }
  return null;
}

async function catalogRecordCount() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    const result = await client.query('SELECT COUNT(*)::int AS count FROM "ThailandVillageMaster"');
    return result.rows[0]?.count ?? 0;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function superAdminCount() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    const result = await client.query('SELECT COUNT(*)::int AS count FROM "User" WHERE "systemRole" = \'SUPERADMIN\'');
    return result.rows[0]?.count ?? 0;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function rawCatalogExists() {
  if (!(await exists(rawCatalogDirectory))) return false;
  const entries = await fs.readdir(rawCatalogDirectory);
  return entries.some((entry) => path.extname(entry).toLowerCase() === ".json");
}

async function setupCatalog() {
  const processedExists = await exists(processedCatalogPath);
  const rawExists = await rawCatalogExists();
  const demoExists = await exists(demoCatalogPath);
  const count = await catalogRecordCount();

  // A full Thailand catalog contains far more than the small demo catalog. This lets a
  // later full import replace a previously imported demo without reimporting each setup.
  const fullCatalogAvailable = processedExists || rawExists;
  const alreadyReady = fullCatalogAvailable ? count >= 1000 : count > 0;

  if (alreadyReady) {
    console.log(`Catalog มีอยู่แล้ว ${count.toLocaleString()} รายการ — ข้ามการนำเข้าซ้ำ`);
  } else if (processedExists) {
    console.log("พบ data/processed/thailand-villages.json — กำลังนำเข้า Catalog");
    await run(process.execPath, ["scripts/import-thailand-villages.mjs", "--insert-only"], "การนำเข้าข้อมูลหมู่บ้าน");
  } else if (rawExists) {
    console.log("ไม่พบไฟล์ processed แต่พบ JSON ดิบ — กำลังเตรียม Catalog");
    await run(process.execPath, ["scripts/prepare-thailand-villages.mjs"], "การเตรียมข้อมูลหมู่บ้าน");
    if (!(await exists(processedCatalogPath))) {
      throw new Error("เตรียมข้อมูลหมู่บ้านไม่สำเร็จ: ไม่พบ data/processed/thailand-villages.json");
    }
    await run(process.execPath, ["scripts/import-thailand-villages.mjs", "--insert-only"], "การนำเข้าข้อมูลหมู่บ้าน");
  } else if (demoExists) {
    console.warn("ไม่พบข้อมูล Catalog ฉบับเต็ม — จะใช้ demo catalog สำหรับทดลองระบบ");
    await run(process.execPath, ["scripts/import-thailand-villages.mjs", "data/demo/thailand-villages.demo.json", "--insert-only"], "การนำเข้าข้อมูล demo");
  } else {
    console.warn("ไม่พบไฟล์ข้อมูลหมู่บ้าน: วาง JSON ดิบที่ data/raw/gdcatalog-villages/ หรือใส่ data/processed/thailand-villages.json");
    console.warn("ข้าม Catalog เพราะระบบยังเริ่มต้นได้ แต่หน้าเลือกหมู่บ้านจะยังไม่มีข้อมูล");
  }
}

async function main() {
  process.chdir(projectRoot);
  const [major, minor] = process.versions.node.split(".").map(Number);
  console.log(`[1/${databaseOnly ? 6 : 8}] ตรวจ Node.js (${process.version})`);
  if (major < 20 || (major === 20 && minor < 9)) {
    throw new Error(`ต้องใช้ Node.js 20.9.0 ขึ้นไป (พบ ${process.version})`);
  }

  console.log(`[2/${databaseOnly ? 6 : 8}] ตรวจไฟล์ .env`);
  await ensureEnvironmentFile();

  console.log(`[3/${databaseOnly ? 6 : 8}] ตรวจฐานข้อมูล`);
  await checkDatabase();

  console.log(`[4/${databaseOnly ? 6 : 8}] Prisma generate`);
  await run(commandName("npx"), ["prisma", "generate"], "Prisma generate");

  console.log(`[5/${databaseOnly ? 6 : 8}] ใช้ Prisma migrations`);
  await run(commandName("npx"), ["prisma", "migrate", "deploy"], "Prisma migrate deploy");

  console.log(`[6/${databaseOnly ? 6 : 8}] ตรวจ seed data`);
  const seedCommand = await getSeedCommand();
  if (seedCommand) {
    await run(seedCommand.command, seedCommand.args, seedCommand.label);
  } else {
    console.log("ไม่พบ seed script เดิม — ข้ามขั้นตอนนี้");
  }

  if (databaseOnly) {
    console.log("\nฐานข้อมูลพร้อมใช้งานแล้ว");
    return;
  }

  console.log("[7/8] นำเข้าข้อมูลหมู่บ้าน");
  await setupCatalog();

  console.log("[8/8] ตรวจสถานะ Catalog");
  await run(process.execPath, ["scripts/catalog-status.mjs"], "การตรวจสถานะ Catalog");

  const superAdmins = await superAdminCount();
  console.log("\nพร้อมใช้งานแล้ว: รัน npm run dev แล้วเปิด http://localhost:3000");
  if (superAdmins === 0) {
    console.log("ยังไม่มี Super Admin: เปิด http://localhost:3000/superadmin/setup");
    console.log("ใช้รหัสจาก SUPERADMIN_BOOTSTRAP_SECRET ในไฟล์ .env เพื่อสร้างผู้ดูแลคนแรก");
  }
}

main().catch((error) => {
  console.error(`\nSetup ไม่สำเร็จ\n${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
