import { getAllProvinces } from "geothai";

export type ThaiDistrict = {
  name: string;
  subdistricts: string[];
};

export type ThaiProvince = {
  name: string;
  districts: ThaiDistrict[];
};

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

  return provinces.map((province) => ({
    name: province.name_th,
    districts: (province.districts ?? []).map((district) => ({
      name: district.name_th,
      subdistricts: (district.subdistricts ?? []).map((subdistrict) => subdistrict.name_th),
    })),
  }));
}