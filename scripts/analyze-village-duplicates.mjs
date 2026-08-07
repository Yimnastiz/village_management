import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const inputPath = process.argv[2] || "data/processed/thailand-villages.json";
const clean = (value) => String(value ?? "").normalize("NFC").replace(/\s+/gu, " ").trim();
const area = (value) => clean(value).replace(/^(จังหวัด|จ\.?|อำเภอ|อ\.?|ตำบล|ต\.?)/u, "").trim();
const keyPart = (value) => clean(value).toLocaleLowerCase("th-TH");
function deriveMooFromOfficialCode(officialCode) {
  const code = String(officialCode ?? "").trim();
  const suffix = code.slice(-2);
  if (!/^\d{2}$/.test(suffix)) return null;
  const moo = Number.parseInt(suffix, 10);
  return Number.isFinite(moo) && moo > 0 ? moo : null;
}
function slugify(value) {
  return clean(value).toLocaleLowerCase("th-TH").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/-+/gu, "-").replace(/^-|-$/gu, "");
}
function catalogSlug(row) {
  const name = slugify(row.villageName) || "village";
  const moo = deriveMooFromOfficialCode(row.officialCode) ?? Number.parseInt(clean(row.moo), 10);
  const identity = slugify(row.officialCode || row.id || "");
  return [name, Number.isFinite(moo) && moo > 0 ? String(moo) : "", identity].filter(Boolean).join("-");
}
function groups(rows, makeKey) {
  const map = new Map();
  for (const row of rows) { const key = makeKey(row); if (!map.has(key)) map.set(key, []); map.get(key).push(row); }
  return [...map.values()].filter((items) => items.length > 1);
}
const groupSummary = (rows, makeKey) => {
  const duplicateGroups = groups(rows, makeKey);
  return { groups: duplicateGroups.length, records: duplicateGroups.reduce((sum, items) => sum + items.length, 0) };
};

const source = path.resolve(process.cwd(), inputPath);
const rows = JSON.parse(await fs.readFile(source, "utf8"));
if (!Array.isArray(rows)) throw new Error("Processed catalog must be a JSON array");
const villages = rows.map((raw, index) => ({
  id: String(raw.id ?? index + 1), officialCode: clean(raw.officialCode), villageName: clean(raw.villageName),
  province: area(raw.province), district: area(raw.district), subdistrict: area(raw.subdistrict),
  moo: deriveMooFromOfficialCode(raw.officialCode) ?? (Number.isFinite(Number(raw.moo)) ? Number(raw.moo) : null),
}));
const nameKey = (row) => keyPart(row.villageName);
const officialDuplicates = groups(villages.filter((row) => row.officialCode), (row) => row.officialCode);
const nationwide = groups(villages, nameKey);
const sameProvince = groupSummary(villages, (r) => `${keyPart(r.province)}|${nameKey(r)}`);
const sameDistrict = groupSummary(villages, (r) => `${keyPart(r.province)}|${keyPart(r.district)}|${nameKey(r)}`);
const sameSubdistrict = groupSummary(villages, (r) => `${keyPart(r.province)}|${keyPart(r.district)}|${keyPart(r.subdistrict)}|${nameKey(r)}`);
const sameNameMooAcrossAreas = groups(villages.filter((r) => r.moo !== null), (r) => `${nameKey(r)}|${r.moo}`)
  .filter((items) => new Set(items.map((r) => `${r.province}|${r.district}|${r.subdistrict}`)).size > 1);
const slugDuplicates = groups(villages, catalogSlug);
const top = nationwide.map((items) => ({ name: items[0].villageName, count: items.length })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "th")).slice(0, 20);
const khaoSai = villages.filter((row) => row.villageName === "เขาทราย");
console.log(JSON.stringify({
  input: source, totalVillages: villages.length, officialCodes: new Set(villages.filter((r) => r.officialCode).map((r) => r.officialCode)).size,
  missingOfficialCode: villages.filter((r) => !r.officialCode).length, duplicateOfficialCodeGroups: officialDuplicates.length,
  duplicateVillageNamesNationwide: { groups: nationwide.length, records: nationwide.reduce((sum, items) => sum + items.length, 0) },
  duplicateNamesWithinProvince: sameProvince, duplicateNamesWithinProvinceDistrict: sameDistrict,
  duplicateNamesWithinProvinceDistrictSubdistrict: sameSubdistrict,
  duplicateVillageNameMooAcrossAreas: { groups: sameNameMooAcrossAreas.length, records: sameNameMooAcrossAreas.reduce((sum, items) => sum + items.length, 0) },
  generatedSlugDuplicateGroups: slugDuplicates.length, topDuplicateNames: top,
  khaoSaiExamples: khaoSai.map((r) => ({ moo: r.moo, subdistrict: r.subdistrict, district: r.district, province: r.province, officialCode: r.officialCode })).sort((a, b) => (a.moo ?? 0) - (b.moo ?? 0)),
}, null, 2));
