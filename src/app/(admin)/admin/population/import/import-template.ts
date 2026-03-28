export type PopulationImportColumn = {
  key: string;
  label: string;
  required: boolean;
  description: string;
  example: string;
  acceptedValues?: string;
  aliases?: string[];
};

export const POPULATION_IMPORT_COLUMNS: PopulationImportColumn[] = [
  {
    key: "house_number",
    label: "เลขที่บ้าน",
    required: true,
    description: "เลขที่บ้านอ้างอิงหลักของครัวเรือนในหมู่บ้าน",
    example: "99/12",
    aliases: ["house number", "house no", "house no.", "เลขที่บ้าน", "บ้านเลขที่", "เลขบ้าน"],
  },
  {
    key: "first_name",
    label: "ชื่อ",
    required: true,
    description: "ชื่อจริงของบุคคล",
    example: "สมชาย",
    aliases: ["first name", "firstname", "given_name", "ชื่อ", "ชื่อจริง"],
  },
  {
    key: "last_name",
    label: "นามสกุล",
    required: true,
    description: "นามสกุลของบุคคล",
    example: "ใจดี",
    aliases: ["last name", "lastname", "family_name", "surname", "นามสกุล", "สกุล"],
  },
  {
    key: "phone_number",
    label: "เบอร์โทรศัพท์",
    required: false,
    description: "ใช้ผูกบัญชีผู้ใช้และค้นหาข้อมูลซ้ำ",
    example: "0812345678",
    aliases: [
      "phone",
      "mobile",
      "mobile_phone",
      "phone no",
      "phone no.",
      "เบอร์โทร",
      "เบอร์โทรศัพท์",
      "โทรศัพท์",
      "หมายเลขโทรศัพท์",
      "มือถือ",
    ],
  },
  {
    key: "national_id",
    label: "เลขบัตรประชาชน",
    required: false,
    description: "ถ้ามี ระบบจะใช้ช่วยจับคู่บุคคลเดิม",
    example: "1234567890123",
    aliases: [
      "citizen_id",
      "citizen id",
      "id_card",
      "เลขบัตรประชาชน",
      "เลขประจำตัวประชาชน",
      "รหัสประชาชน",
    ],
  },
  {
    key: "date_of_birth",
    label: "วันเกิด",
    required: false,
    description: "รองรับวันที่จาก Excel หรือข้อความวันที่มาตรฐาน",
    example: "1988-04-12",
    aliases: ["birth_date", "dob", "วันเกิด", "วันเดือนปีเกิด", "เกิดวันที่"],
  },
  {
    key: "gender",
    label: "เพศ",
    required: false,
    description: "ข้อมูลเพศแบบข้อความทั่วไป",
    example: "ชาย",
    acceptedValues: "ชาย, หญิง, อื่นๆ หรือ male, female, other",
    aliases: ["sex", "เพศ", "gender_th"],
  },
  {
    key: "email",
    label: "อีเมล",
    required: false,
    description: "ใช้กับบัญชีผู้ใช้ถ้าต้องการ",
    example: "somchai@example.com",
    aliases: ["e-mail", "อีเมล", "อีเมล์", "mail"],
  },
  {
    key: "house_address",
    label: "ที่อยู่บ้าน",
    required: false,
    description: "รายละเอียดที่อยู่เพิ่มเติมของบ้านหลังนั้น",
    example: "99/12 หมู่ 4 ถนนกลางหมู่บ้าน",
    aliases: ["address", "house address", "ที่อยู่", "ที่อยู่บ้าน", "address_line"],
  },
  {
    key: "zone_name",
    label: "โซน/หมู่",
    required: false,
    description: "ใช้สร้างหรือจับคู่โซนของบ้านอัตโนมัติ",
    example: "หมู่ 4",
    aliases: ["zone", "zone name", "หมู่", "หมู่ที่", "โซน", "เขต"],
  },
  {
    key: "occupancy_status",
    label: "สถานะบ้าน",
    required: false,
    description: "สถานะการอยู่อาศัยของบ้าน",
    example: "OCCUPIED",
    acceptedValues: "OCCUPIED, VACANT, UNDER_CONSTRUCTION, DEMOLISHED",
    aliases: ["house_status", "occupancy", "สถานะบ้าน", "สถานะครัวเรือน"],
  },
  {
    key: "person_status",
    label: "สถานะบุคคล",
    required: false,
    description: "สถานะล่าสุดของบุคคล",
    example: "ACTIVE",
    acceptedValues: "ACTIVE, DECEASED, MOVED_OUT, UNKNOWN",
    aliases: ["resident_status", "status", "สถานะบุคคล", "สถานะประชากร"],
  },
  {
    key: "latitude",
    label: "ละติจูด",
    required: false,
    description: "พิกัดบ้านสำหรับแผนที่",
    example: "13.7563",
    aliases: ["lat", "ละติจูด", "latitude_house"],
  },
  {
    key: "longitude",
    label: "ลองจิจูด",
    required: false,
    description: "พิกัดบ้านสำหรับแผนที่",
    example: "100.5018",
    aliases: ["lng", "lon", "long", "ลองจิจูด", "longitude_house"],
  },
  {
    key: "create_user_account",
    label: "สร้างบัญชีผู้ใช้",
    required: false,
    description: "ถ้าเป็นจริง ระบบจะสร้างหรืออัปเดตบัญชีผู้ใช้พร้อม membership",
    example: "TRUE",
    acceptedValues: "TRUE/FALSE, YES/NO, 1/0, ใช่/ไม่ใช่",
    aliases: ["create_account", "user_account", "สร้างบัญชีผู้ใช้", "เปิดบัญชีใช้งาน"],
  },
  {
    key: "is_citizen_verified",
    label: "ยืนยันตัวตนแล้ว",
    required: false,
    description: "ใช้ตั้งค่าสถานะยืนยันตัวตนของผู้ใช้จากข้อมูลนำเข้า",
    example: "TRUE",
    acceptedValues: "TRUE/FALSE, YES/NO, 1/0, ใช่/ไม่ใช่",
    aliases: ["verified", "citizen_verified", "ยืนยันตัวตนแล้ว", "ตรวจสอบตัวตนแล้ว"],
  },
  {
    key: "note",
    label: "หมายเหตุ",
    required: false,
    description: "บันทึกเสริมสำหรับการ import หรือข้อมูลภายใน",
    example: "ย้ายเข้ามาใหม่ปี 2026",
    aliases: ["remark", "หมายเหตุ", "บันทึก", "note_internal"],
  },
];

export const POPULATION_IMPORT_HEADER_ALIASES = POPULATION_IMPORT_COLUMNS.reduce<
  Record<string, string[]>
>((accumulator, column) => {
  accumulator[column.key] = [column.key, ...(column.aliases ?? [])];
  return accumulator;
}, {});

export const POPULATION_IMPORT_TEMPLATE_HEADERS = POPULATION_IMPORT_COLUMNS.map(
  (column) => column.key,
);

export const POPULATION_IMPORT_SAMPLE_ROW: Record<string, string> = {
  house_number: "99/12",
  first_name: "สมชาย",
  last_name: "ใจดี",
  phone_number: "0812345678",
  national_id: "1234567890123",
  date_of_birth: "1988-04-12",
  gender: "ชาย",
  email: "somchai@example.com",
  house_address: "99/12 หมู่ 4 ถนนกลางหมู่บ้าน",
  zone_name: "หมู่ 4",
  occupancy_status: "OCCUPIED",
  person_status: "ACTIVE",
  latitude: "13.7563",
  longitude: "100.5018",
  create_user_account: "TRUE",
  is_citizen_verified: "TRUE",
  note: "หัวหน้าครัวเรือน",
};

function escapeCsvValue(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

export function buildPopulationImportTemplateCsv() {
  const headerLine = POPULATION_IMPORT_TEMPLATE_HEADERS.join(",");
  const sampleLine = POPULATION_IMPORT_TEMPLATE_HEADERS.map((header) =>
    escapeCsvValue(POPULATION_IMPORT_SAMPLE_ROW[header] ?? ""),
  ).join(",");

  return `${headerLine}\n${sampleLine}\n`;
}