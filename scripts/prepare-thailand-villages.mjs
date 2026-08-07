import fs from "node:fs/promises";
import path from "node:path";

const rawDirectory = path.resolve(process.cwd(), "data/raw/gdcatalog-villages");
const outputPath = path.resolve(process.cwd(), "data/processed/thailand-villages.json");
const sourceName = "ข้อมูลที่ตั้งและสภาพทั่วไปของหมู่บ้านใน 76 จังหวัด";
const thaiDigits = { "๐": "0", "๑": "1", "๒": "2", "๓": "3", "๔": "4", "๕": "5", "๖": "6", "๗": "7", "๘": "8", "๙": "9" };

export function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).normalize("NFC").replace(/\s+/gu, " ").trim();
}

function arabicDigits(value) {
  return cleanText(value).replace(/[๐-๙]/gu, (digit) => thaiDigits[digit]);
}

export function toNumberOrNull(value) {
  const text = arabicDigits(value).replace(/,/gu, "");
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function toIntOrNull(value) {
  const number = toNumberOrNull(value);
  return number === null ? null : Math.trunc(number);
}

export function deriveMooFromOfficialCode(officialCode) {
  const code = cleanText(officialCode);
  const suffix = code.slice(-2);
  if (!/^\d{2}$/.test(suffix)) return null;
  const moo = Number.parseInt(suffix, 10);
  return Number.isFinite(moo) && moo > 0 ? moo : null;
}

export function normalizeThaiAreaName(value) {
  return cleanText(value).replace(/^(จังหวัด|จ\.|อำเภอ|อ\.|ตำบล|ต\.)\s*/u, "").trim();
}

export function normalizeThaiVillageName(value) {
  return cleanText(value);
}

export function buildLookupKey(item) {
  const area = [item.province, item.district, item.subdistrict, item.villageName]
    .map((value) => cleanText(value).toLocaleLowerCase("th-TH"))
    .join("|");
  return item.officialCode ? area + "|" + item.officialCode : area;
}

function recordsFromJson(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return [];
  for (const key of ["data", "records", "features"]) {
    if (Array.isArray(parsed[key])) return parsed[key];
    if (Array.isArray(parsed[key]?.features)) return parsed[key].features;
  }
  return [];
}

function mapRawRecord(record) {
  const data = record?.properties && typeof record.properties === "object" ? record.properties : record;
  const item = {
    officialCode: arabicDigits(data?.mcode ?? data?.officialCode),
    villageName: normalizeThaiVillageName(data?.mname),
    provinceCode: arabicDigits(data?.pcode),
    province: normalizeThaiAreaName(data?.pname),
    districtCode: arabicDigits(data?.acode),
    district: normalizeThaiAreaName(data?.aname),
    subdistrictCode: arabicDigits(data?.tcode),
    subdistrict: normalizeThaiAreaName(data?.tname),
    latitude: toNumberOrNull(data?.oct_side15_lat),
    longitude: toNumberOrNull(data?.oct_side15_lon),
    populationTotal: toIntOrNull(data?.oct_side15_total),
    malePopulation: toIntOrNull(data?.oct_side15_men),
    femalePopulation: toIntOrNull(data?.oct_side15_wmen),
    householdCount: toIntOrNull(data?.oct_side15_house),
    sourceName,
  };
  item.moo = deriveMooFromOfficialCode(item.officialCode);
  item.lookupKey = buildLookupKey(item);
  return item;
}

async function main() {
  await fs.mkdir(rawDirectory, { recursive: true });
  const files = (await fs.readdir(rawDirectory)).filter((file) => path.extname(file).toLowerCase() === ".json").sort();
  if (!files.length) {
    console.error("ไม่พบไฟล์ JSON ใน data/raw/gdcatalog-villages/ กรุณาวางไฟล์ดิบจาก Government Data Catalog แล้วรันใหม่");
    process.exitCode = 1;
    return;
  }
  const output = [];
  const seen = new Set();
  const summary = { files: files.length, rows: 0, prepared: 0, skipped: 0, duplicates: 0 };
  for (const file of files) {
    let records;
    try {
      records = recordsFromJson(JSON.parse(await fs.readFile(path.join(rawDirectory, file), "utf8")));
    } catch (error) {
      console.error("อ่าน " + file + " ไม่สำเร็จ: " + (error instanceof Error ? error.message : String(error)));
      summary.skipped += 1;
      continue;
    }
    summary.rows += records.length;
    for (const record of records) {
      const item = mapRawRecord(record);
      if (!item.villageName || !item.province || !item.district || !item.subdistrict) {
        summary.skipped += 1;
        continue;
      }
      const dedupeKey = item.officialCode || item.lookupKey;
      if (seen.has(dedupeKey)) {
        summary.duplicates += 1;
        continue;
      }
      seen.add(dedupeKey);
      output.push(item);
      summary.prepared += 1;
    }
  }
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ ...summary, output: path.relative(process.cwd(), outputPath) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
