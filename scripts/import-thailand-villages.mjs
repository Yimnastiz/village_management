import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { PrismaPg } from "@prisma/adapter-pg";
import { AuditAction, PrismaClient } from "@prisma/client";
import { getAllProvinces } from "geothai";

const inputPath = process.argv[2] || "data/thailand-villages.json";
const sourceNameOverride = process.env.VILLAGE_CATALOG_SOURCE_NAME || null;
const sourceUrlOverride = process.env.VILLAGE_CATALOG_SOURCE_URL || null;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) throw new Error("Missing DATABASE_URL");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

function clean(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value == null ? "" : String(value).trim();
}

function first(record, keys) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && clean(record[key])) return clean(record[key]);
  }
  return "";
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === "," && !quoted) { row.push(cell); cell = ""; continue; }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell); cell = "";
      if (row.some((item) => clean(item))) rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [headers, ...data] = rows;
  return data.map((values) => Object.fromEntries(headers.map((header, index) => [clean(header), values[index] ?? ""])));
}

function parseInput(text, extension) {
  if (extension === ".csv") return parseCsv(text);
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : parsed.villages || parsed.data || [];
}

function geographyIndex() {
  const index = new Map();
  for (const province of getAllProvinces()) {
    const provinceName = clean(province.name_th);
    const districts = new Map();
    for (const district of province.districts || []) {
      const districtName = clean(district.name_th);
      districts.set(districtName, new Set((district.subdistricts || []).map((item) => clean(item.name_th))));
    }
    index.set(provinceName, districts);
  }
  return index;
}

function normalizeRecord(record) {
  return {
    officialCode: first(record, ["officialCode", "official_code", "villageCode", "village_code", "รหัสหมู่บ้าน"]) || null,
    villageName: first(record, ["villageName", "village_name", "name", "ชื่อหมู่บ้าน"]),
    moo: first(record, ["moo", "หมู่ที่", "หมู่ท่ี"]) || null,
    subdistrict: first(record, ["subdistrict", "subdistrictName", "ตำบล"]),
    district: first(record, ["district", "districtName", "อำเภอ"]),
    province: first(record, ["province", "provinceName", "จังหวัด"]),
    latitude: first(record, ["latitude", "lat", "ละติจูด"]),
    longitude: first(record, ["longitude", "lng", "ลองจิจูด"]),
    sourceName: first(record, ["sourceName", "source_name", "แหล่งข้อมูล"]) || sourceNameOverride,
    sourceUrl: first(record, ["sourceUrl", "source_url", "ที่มา"]) || sourceUrlOverride,
    sourceUpdatedAt: first(record, ["sourceUpdatedAt", "source_updated_at", "วันที่ปรับปรุง"]),
  };
}

function numberOrNull(value) {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function dateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const absolutePath = path.resolve(process.cwd(), inputPath);
const extension = path.extname(absolutePath).toLowerCase();
const records = parseInput(await fs.readFile(absolutePath, "utf8"), extension);
const geography = geographyIndex();
const summary = { created: 0, updated: 0, skipped: 0, errors: 0 };

for (let index = 0; index < records.length; index += 1) {
  const item = normalizeRecord(records[index]);
  const parent = geography.get(item.province);
  const subdistricts = parent?.get(item.district);
  const valid = item.villageName && parent && subdistricts && subdistricts.has(item.subdistrict);
  if (!valid) {
    summary.errors += 1;
    console.error(`row ${index + 2}: invalid village or GeoThai location`);
    continue;
  }

  const data = {
    officialCode: item.officialCode,
    villageName: item.villageName,
    moo: item.moo,
    subdistrict: item.subdistrict,
    district: item.district,
    province: item.province,
    latitude: numberOrNull(item.latitude),
    longitude: numberOrNull(item.longitude),
    sourceName: item.sourceName,
    sourceUrl: item.sourceUrl,
    sourceUpdatedAt: dateOrNull(item.sourceUpdatedAt),
  };

  try {
    const existing = item.officialCode
      ? await prisma.thailandVillageMaster.findUnique({ where: { officialCode: item.officialCode }, select: { id: true } })
      : await prisma.thailandVillageMaster.findFirst({ where: { province: item.province, district: item.district, subdistrict: item.subdistrict, villageName: item.villageName, moo: item.moo }, select: { id: true } });
    if (existing) {
      await prisma.thailandVillageMaster.update({ where: { id: existing.id }, data });
      await prisma.auditLog.create({ data: { action: AuditAction.VILLAGE_CATALOG_UPDATED, resource: "ThailandVillageMaster", resourceId: existing.id, metadata: { officialCode: item.officialCode, villageName: item.villageName, sourceName: item.sourceName } } });
      summary.updated += 1;
    } else {
      const created = await prisma.thailandVillageMaster.create({ data });
      await prisma.auditLog.create({ data: { action: AuditAction.VILLAGE_CATALOG_IMPORTED, resource: "ThailandVillageMaster", resourceId: created.id, metadata: { officialCode: item.officialCode, villageName: item.villageName, sourceName: item.sourceName } } });
      summary.created += 1;
    }
  } catch (error) {
    summary.errors += 1;
    console.error(`row ${index + 2}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(JSON.stringify({ input: absolutePath, rows: records.length, ...summary }, null, 2));
await prisma.$disconnect();
