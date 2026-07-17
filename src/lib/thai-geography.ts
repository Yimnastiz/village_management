import { getAllProvinces } from "geothai";

const EXPECTED_THAILAND_PROVINCES = 77;

export type ThaiDistrict = {
  name: string;
  subdistricts: string[];
};

export type ThaiProvince = {
  name: string;
  districts: ThaiDistrict[];
};

function normalizeText(value: string | undefined): string {
  return (value ?? "").trim();
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right, "th"));
}

function warnIfInvalidProvinceCount(provinces: ThaiProvince[]): void {
  if (provinces.length !== EXPECTED_THAILAND_PROVINCES) {
    console.warn(
      `[thai-geography] expected ${EXPECTED_THAILAND_PROVINCES} provinces but got ${provinces.length}.`
    );
  }
}

export function getThaiGeographyHierarchy(): ThaiProvince[] {
  const provinces = getAllProvinces() as Array<{
    name_th: string;
    districts?: Array<{
      name_th: string;
      subdistricts?: Array<{
        name_th: string;
      }>;
    }>;
  }>;

  const normalizedProvinces = provinces
    .map((province) => {
      const provinceName = normalizeText(province.name_th);
      if (!provinceName) {
        return null;
      }

      const districtMap = new Map<string, Set<string>>();

      for (const district of province.districts ?? []) {
        const districtName = normalizeText(district.name_th);
        if (!districtName) {
          continue;
        }

        if (!districtMap.has(districtName)) {
          districtMap.set(districtName, new Set<string>());
        }

        const subdistrictSet = districtMap.get(districtName);
        if (!subdistrictSet) {
          continue;
        }

        for (const subdistrict of district.subdistricts ?? []) {
          const subdistrictName = normalizeText(subdistrict.name_th);
          if (subdistrictName) {
            subdistrictSet.add(subdistrictName);
          }
        }
      }

      const districts: ThaiDistrict[] = Array.from(districtMap.entries())
        .map(([districtName, subdistrictSet]) => ({
          name: districtName,
          subdistricts: uniqueSorted(Array.from(subdistrictSet)),
        }))
        .sort((left, right) => left.name.localeCompare(right.name, "th"));

      return {
        name: provinceName,
        districts,
      } as ThaiProvince;
    })
    .filter((province): province is ThaiProvince => province !== null);

  const dedupedByProvince = new Map<string, Map<string, Set<string>>>();
  for (const province of normalizedProvinces) {
    if (!dedupedByProvince.has(province.name)) {
      dedupedByProvince.set(province.name, new Map<string, Set<string>>());
    }

    const districtMap = dedupedByProvince.get(province.name);
    if (!districtMap) {
      continue;
    }

    for (const district of province.districts) {
      if (!districtMap.has(district.name)) {
        districtMap.set(district.name, new Set<string>());
      }

      const subdistrictSet = districtMap.get(district.name);
      if (!subdistrictSet) {
        continue;
      }

      for (const subdistrict of district.subdistricts) {
        subdistrictSet.add(subdistrict);
      }
    }
  }

  const result: ThaiProvince[] = Array.from(dedupedByProvince.entries())
    .map(([provinceName, districtMap]) => ({
      name: provinceName,
      districts: Array.from(districtMap.entries())
        .map(([districtName, subdistrictSet]) => ({
          name: districtName,
          subdistricts: uniqueSorted(Array.from(subdistrictSet)),
        }))
        .sort((left, right) => left.name.localeCompare(right.name, "th")),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "th"));

  warnIfInvalidProvinceCount(result);
  return result;
}

export function validateThaiGeographySelection(input: {
  province: string;
  district: string;
  subdistrict: string;
}): { ok: true } | { ok: false; error: string } {
  const provinceName = normalizeText(input.province);
  const districtName = normalizeText(input.district);
  const subdistrictName = normalizeText(input.subdistrict);

  if (!provinceName) return { ok: false, error: "กรุณาเลือกจังหวัด" };
  if (!districtName) return { ok: false, error: "กรุณาเลือกอำเภอ" };
  if (!subdistrictName) return { ok: false, error: "กรุณาเลือกตำบล" };

  const province = getThaiGeographyHierarchy().find((item) => item.name === provinceName);
  if (!province) return { ok: false, error: "จังหวัดต้องอยู่ในชุดข้อมูล GeoThai" };

  const district = province.districts.find((item) => item.name === districtName);
  if (!district) return { ok: false, error: "อำเภอต้องสัมพันธ์กับจังหวัดที่เลือก" };

  if (!district.subdistricts.includes(subdistrictName)) {
    return { ok: false, error: "ตำบลต้องสัมพันธ์กับอำเภอที่เลือก" };
  }

  return { ok: true };
}
