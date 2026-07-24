export type BuiltInVillageCatalogItem = {
  officialCode: string;
  villageName: string;
  moo?: string;
  subdistrict: string;
  district: string;
  province: string;
  sourceName: string;
};

// Demo records keep a fresh clone usable. They are not an official nationwide dataset.
export const BUILT_IN_THAILAND_VILLAGE_CATALOG: BuiltInVillageCatalogItem[] = [
  { officialCode: "DEMO-PHICHIT-THAPKHLO-KHAOSAI-001", villageName: "บ้านเขาพระ", moo: "1", subdistrict: "เขาทราย", district: "ทับคล้อ", province: "พิจิตร", sourceName: "Built-in demo catalog" },
  { officialCode: "DEMO-PHICHIT-THAPKHLO-KHAOSAI-002", villageName: "บ้านเขาทราย", moo: "2", subdistrict: "เขาทราย", district: "ทับคล้อ", province: "พิจิตร", sourceName: "Built-in demo catalog" },
  { officialCode: "DEMO-PHICHIT-THAPKHLO-KHAOSAI-003", villageName: "บ้านหนองพง", moo: "3", subdistrict: "เขาทราย", district: "ทับคล้อ", province: "พิจิตร", sourceName: "Built-in demo catalog" },
  { officialCode: "DEMO-CHIANGMAI-MUEANG-SUTHEP-001", villageName: "บ้านสุเทพ", moo: "1", subdistrict: "สุเทพ", district: "เมืองเชียงใหม่", province: "เชียงใหม่", sourceName: "Built-in demo catalog" },
  { officialCode: "DEMO-CHIANGMAI-MUEANG-CHANGPHUEAK-001", villageName: "บ้านช้างเผือก", moo: "2", subdistrict: "ช้างเผือก", district: "เมืองเชียงใหม่", province: "เชียงใหม่", sourceName: "Built-in demo catalog" },
  { officialCode: "DEMO-CHIANGMAI-MUEANG-SRIPHUM-001", villageName: "บ้านศรีภูมิ", moo: "3", subdistrict: "ศรีภูมิ", district: "เมืองเชียงใหม่", province: "เชียงใหม่", sourceName: "Built-in demo catalog" },
  { officialCode: "DEMO-KHONKAEN-MUEANG-NAIMUEANG-001", villageName: "บ้านในเมือง", moo: "1", subdistrict: "ในเมือง", district: "เมืองขอนแก่น", province: "ขอนแก่น", sourceName: "Built-in demo catalog" },
  { officialCode: "DEMO-KHONKAEN-MUEANG-BANPET-001", villageName: "บ้านเป็ด", moo: "2", subdistrict: "บ้านเป็ด", district: "เมืองขอนแก่น", province: "ขอนแก่น", sourceName: "Built-in demo catalog" },
];

export function findBuiltInVillageCatalogItem(id: string) {
  return BUILT_IN_THAILAND_VILLAGE_CATALOG.find((item) => item.officialCode === id) ?? null;
}
