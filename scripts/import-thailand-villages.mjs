import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { PrismaPg } from "@prisma/adapter-pg";
import { AuditAction, PrismaClient } from "@prisma/client";

const defaultInput = "data/processed/thailand-villages.json";
const arguments_ = process.argv.slice(2);
const inputPath = arguments_.find((argument) => !argument.startsWith("--")) || defaultInput;
const insertOnly = arguments_.includes("--insert-only");

if (!process.env.DATABASE_URL) throw new Error("Missing DATABASE_URL");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const clean = (value) => value == null ? "" : String(value).normalize("NFC").replace(/\s+/gu, " ").trim();
const normalizeArea = (value) => clean(value).replace(/^(จังหวัด|จ\.|อำเภอ|อ\.|ตำบล|ต\.)\s*/u, "").trim();
const normalized = (value) => clean(value).toLocaleLowerCase("th-TH");
const thaiDigits = "๐๑๒๓๔๕๖๗๘๙";

const numberOrNull = (value, integer = false) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[๐-๙]/gu, (digit) => String(thaiDigits.indexOf(digit))).replace(/,/gu, ""));
  return Number.isFinite(parsed) ? (integer ? Math.trunc(parsed) : parsed) : null;
};

const buildLookupKey = (item) => {
  const base = [item.province, item.district, item.subdistrict, item.villageName].map(normalized).join("|");
  return item.officialCode ? `${base}|${clean(item.officialCode)}` : base;
};

const deriveMooFromOfficialCode = (officialCode) => {
  const code = clean(officialCode);
  const suffix = code.slice(-2);
  if (!/^\d{2}$/.test(suffix)) return null;
  const moo = Number.parseInt(suffix, 10);
  return Number.isFinite(moo) && moo > 0 ? moo : null;
};

function toCatalogRecord(raw) {
  const item = {
    officialCode: clean(raw.officialCode) || null,
    villageName: clean(raw.villageName),
    moo: raw.moo == null || raw.moo === "" ? null : String(raw.moo),
    provinceCode: clean(raw.provinceCode) || null,
    province: normalizeArea(raw.province),
    districtCode: clean(raw.districtCode) || null,
    district: normalizeArea(raw.district),
    subdistrictCode: clean(raw.subdistrictCode) || null,
    subdistrict: normalizeArea(raw.subdistrict),
    latitude: numberOrNull(raw.latitude),
    longitude: numberOrNull(raw.longitude),
    populationTotal: numberOrNull(raw.populationTotal, true),
    malePopulation: numberOrNull(raw.malePopulation, true),
    femalePopulation: numberOrNull(raw.femalePopulation, true),
    householdCount: numberOrNull(raw.householdCount, true),
    sourceName: clean(raw.sourceName) || null,
    sourceUrl: clean(raw.sourceUrl) || null,
  };
  // Official data defines moo as the last two digits of the official code.
  // Always recalculate when a valid code is present so rerunning import backfills
  // old catalog records and never preserves a stale source value.
  const derivedMoo = deriveMooFromOfficialCode(item.officialCode);
  if (derivedMoo !== null) item.moo = String(derivedMoo);
  const lookupKey = clean(raw.lookupKey) || buildLookupKey(item);
  if (!item.villageName || !item.province || !item.district || !item.subdistrict || (!item.officialCode && !lookupKey)) return null;
  return {
    item,
    lookupKey,
    data: {
      ...item,
      lookupKey,
      normalizedName: normalized(item.villageName),
      normalizedProvince: normalized(item.province),
      normalizedDistrict: normalized(item.district),
      normalizedSubdistrict: normalized(item.subdistrict),
      importedAt: new Date(),
    },
  };
}

async function main() {
  const absoluteInput = path.resolve(process.cwd(), inputPath);
  let rows;
  try {
    rows = JSON.parse(await fs.readFile(absoluteInput, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`ไม่พบไฟล์ ${inputPath}\nวาง JSON ดิบไว้ที่ data/raw/gdcatalog-villages/ แล้วรัน npm run catalog:prepare`);
    }
    throw error;
  }
  if (!Array.isArray(rows)) throw new Error("ไฟล์ processed ต้องเป็น JSON array");

  const summary = { rows: rows.length, created: 0, updated: 0, skipped: 0, errors: 0 };

  if (insertOnly) {
    const batchSize = 500;
    for (let offset = 0; offset < rows.length; offset += batchSize) {
      const batch = [];
      for (const raw of rows.slice(offset, offset + batchSize)) {
        const record = toCatalogRecord(raw ?? {});
        if (record) batch.push(record.data);
        else summary.skipped += 1;
      }
      if (!batch.length) continue;
      const result = await prisma.thailandVillageMaster.createMany({ data: batch, skipDuplicates: true });
      summary.created += result.count;
      summary.skipped += batch.length - result.count;
      console.log(`นำเข้าแบบ batch แล้ว ${Math.min(offset + batchSize, rows.length)}/${rows.length}`);
    }
  } else {
    for (let index = 0; index < rows.length; index += 1) {
      const record = toCatalogRecord(rows[index] ?? {});
      if (!record) {
        summary.skipped += 1;
        continue;
      }
      const { item, lookupKey, data } = record;
      try {
        const existing = item.officialCode
          ? await prisma.thailandVillageMaster.findUnique({ where: { officialCode: item.officialCode }, select: { id: true } })
          : await prisma.thailandVillageMaster.findUnique({ where: { lookupKey }, select: { id: true } });
        if (existing) {
          await prisma.thailandVillageMaster.update({ where: { id: existing.id }, data });
          await prisma.village.updateMany({
            where: { catalogVillageId: existing.id },
            data: { moo: item.moo },
          });
          summary.updated += 1;
        } else {
          const created = await prisma.thailandVillageMaster.create({ data });
          await prisma.auditLog.create({
            data: {
              action: AuditAction.VILLAGE_CATALOG_IMPORTED,
              resource: "ThailandVillageMaster",
              resourceId: created.id,
              metadata: { officialCode: item.officialCode, lookupKey, sourceName: item.sourceName },
            },
          });
          summary.created += 1;
        }
      } catch (error) {
        summary.errors += 1;
        console.error(`row ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
      }
      if ((index + 1) % 1000 === 0) console.log(`นำเข้าแล้ว ${index + 1}/${rows.length}`);
    }
  }

  const total = await prisma.thailandVillageMaster.count();
  console.log(JSON.stringify({ input: absoluteInput, mode: insertOnly ? "insert-only" : "upsert", ...summary, total }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
