import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { PrismaPg } from "@prisma/adapter-pg";
import { AuditAction, PrismaClient } from "@prisma/client";

const defaultInput = "data/processed/thailand-villages.json";
const inputPath = process.argv[2] || defaultInput;
if (!process.env.DATABASE_URL) throw new Error("Missing DATABASE_URL");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const clean = (value) => value == null ? "" : String(value).normalize("NFC").replace(/\s+/gu, " ").trim();
const normalizeArea = (value) => clean(value).replace(/^(จังหวัด|จ\.|อำเภอ|อ\.|ตำบล|ต\.)\s*/u, "").trim();
const normalized = (value) => clean(value).toLocaleLowerCase("th-TH");
const numberOrNull = (value, integer = false) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[๐-๙]/gu, (digit) => "0123456789"["๐๑๒๓๔๕๖๗๘๙".indexOf(digit)]).replace(/,/gu, ""));
  return Number.isFinite(parsed) ? (integer ? Math.trunc(parsed) : parsed) : null;
};
const buildLookupKey = (item) => {
  const base = [item.province, item.district, item.subdistrict, item.villageName].map(normalized).join("|");
  return item.officialCode ? base + "|" + clean(item.officialCode) : base;
};

async function main() {
  const absoluteInput = path.resolve(process.cwd(), inputPath);
  let rows;
  try {
    rows = JSON.parse(await fs.readFile(absoluteInput, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error("ไม่พบไฟล์ " + inputPath + "\nให้วางไฟล์ JSON ดิบไว้ที่ data/raw/gdcatalog-villages/ แล้วรัน npm run catalog:prepare ก่อน");
    throw error;
  }
  if (!Array.isArray(rows)) throw new Error("ไฟล์ processed ต้องเป็น JSON array");
  const summary = { rows: rows.length, created: 0, updated: 0, skipped: 0, errors: 0 };
  for (let index = 0; index < rows.length; index += 1) {
    const raw = rows[index] ?? {};
    const item = {
      officialCode: clean(raw.officialCode) || null, villageName: clean(raw.villageName),
      provinceCode: clean(raw.provinceCode) || null, province: normalizeArea(raw.province),
      districtCode: clean(raw.districtCode) || null, district: normalizeArea(raw.district),
      subdistrictCode: clean(raw.subdistrictCode) || null, subdistrict: normalizeArea(raw.subdistrict),
      latitude: numberOrNull(raw.latitude), longitude: numberOrNull(raw.longitude),
      populationTotal: numberOrNull(raw.populationTotal, true), malePopulation: numberOrNull(raw.malePopulation, true),
      femalePopulation: numberOrNull(raw.femalePopulation, true), householdCount: numberOrNull(raw.householdCount, true),
      sourceName: clean(raw.sourceName) || null, sourceUrl: clean(raw.sourceUrl) || null,
    };
    const lookupKey = clean(raw.lookupKey) || buildLookupKey(item);
    if (!item.villageName || !item.province || !item.district || !item.subdistrict || (!item.officialCode && !lookupKey)) {
      summary.skipped += 1;
      continue;
    }
    const data = { ...item, lookupKey, normalizedName: normalized(item.villageName), normalizedProvince: normalized(item.province), normalizedDistrict: normalized(item.district), normalizedSubdistrict: normalized(item.subdistrict), importedAt: new Date() };
    try {
      const existing = item.officialCode
        ? await prisma.thailandVillageMaster.findUnique({ where: { officialCode: item.officialCode }, select: { id: true } })
        : await prisma.thailandVillageMaster.findUnique({ where: { lookupKey }, select: { id: true } });
      if (existing) {
        await prisma.thailandVillageMaster.update({ where: { id: existing.id }, data });
        summary.updated += 1;
      } else {
        const created = await prisma.thailandVillageMaster.create({ data });
        await prisma.auditLog.create({ data: { action: AuditAction.VILLAGE_CATALOG_IMPORTED, resource: "ThailandVillageMaster", resourceId: created.id, metadata: { officialCode: item.officialCode, lookupKey, sourceName: item.sourceName } } });
        summary.created += 1;
      }
    } catch (error) {
      summary.errors += 1;
      console.error("row " + (index + 1) + ": " + (error instanceof Error ? error.message : String(error)));
    }
    if ((index + 1) % 1000 === 0) console.log("นำเข้าแล้ว " + (index + 1) + "/" + rows.length);
  }
  const [total, khaoSai, naiMueang] = await Promise.all([
    prisma.thailandVillageMaster.count(),
    prisma.thailandVillageMaster.count({ where: { province: "พิจิตร", district: "ทับคล้อ", subdistrict: "เขาทราย" } }),
    prisma.thailandVillageMaster.count({ where: { province: "พิจิตร", district: "เมืองพิจิตร", subdistrict: "ในเมือง" } }),
  ]);
  console.log(JSON.stringify({ input: absoluteInput, ...summary, total, sampleAreas: { "พิจิตร/ทับคล้อ/เขาทราย": khaoSai, "พิจิตร/เมืองพิจิตร/ในเมือง": naiMueang } }, null, 2));
}

main().catch((error) => { console.error(error.message || error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
