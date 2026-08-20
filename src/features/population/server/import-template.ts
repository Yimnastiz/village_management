export type PopulationImportColumn = {
  key: string;
  label: string;
  required: boolean;
  description: string;
  example: string;
  acceptedValues?: string;
  aliases?: string[];
  adminOnly?: boolean;
};

// All columns including advanced/legacy fields
const ALL_POPULATION_IMPORT_COLUMNS: PopulationImportColumn[] = [
  {
    key: "house_number",
    label: "เลขที่บ้าน",
    required: true,
    description: "เลขที่บ้านอ้างอิงหลักของครัวเรือนในหมู่บ้าน",
    example: "99/12",
    aliases: ["house number", "house no", "house no.", "เลขที่บ้าน", "บ้านเลขที่", "เลขบ้าน"],
  },
  {
    key: "external_person_id",
    label: "รหัสบุคคลจากทะเบียน",
    required: false,
    description: "รหัสอ้างอิงจากระบบทะเบียน ใช้ช่วยตรวจสอบซ้ำ ไม่ใช้ยืนยันตัวตน",
    example: "PERSON-0001",
    aliases: ["external person id", "person id", "รหัสบุคคล"],
  },
  {
    key: "first_name",
    label: "ชื่อ",
    required: false,
    description: "ชื่อจริงของบุคคล",
    example: "สมชาย",
    aliases: ["first name", "firstname", "given_name", "ชื่อ", "ชื่อจริง"],
  },
  {
    key: "last_name",
    label: "นามสกุล",
    required: false,
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
    example: "มีผู้อยู่อาศัย",
    acceptedValues: "มีผู้อยู่อาศัย, ว่าง, กำลังก่อสร้าง, รื้อถอนแล้ว หรือ OCCUPIED, VACANT, UNDER_CONSTRUCTION, DEMOLISHED",
    aliases: ["house_status", "occupancy", "สถานะบ้าน", "สถานะครัวเรือน"],
  },
  {
    key: "person_status",
    label: "สถานะบุคคล",
    required: false,
    description: "สถานะล่าสุดของบุคคล",
    example: "อยู่ในทะเบียน",
    acceptedValues: "อยู่ในทะเบียน, ย้ายออก, เสียชีวิต, ไม่ทราบสถานะ หรือ ACTIVE, DECEASED, MOVED_OUT, UNKNOWN",
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
    key: "movement_type",
    label: "ประเภทการย้าย",
    required: false,
    description: "MOVE_IN, MOVE_OUT หรือ TRANSFER",
    example: "MOVE_IN",
    acceptedValues: "MOVE_IN, MOVE_OUT, TRANSFER, BIRTH, DEATH",
    aliases: ["movement", "movement type", "ประเภทการย้าย"],
  },
  {
    key: "movement_date",
    label: "วันที่ย้าย",
    required: false,
    description: "วันที่บันทึกการย้ายเข้า/ออก",
    example: "2026-01-15",
    aliases: ["movement date", "วันที่ย้าย"],
  },
  {
    key: "create_user_account",
    label: "สร้างบัญชีผู้ใช้",
    required: false,
    description: "ถ้าเป็นจริง ระบบจะสร้างหรืออัปเดตบัญชีผู้ใช้พร้อม membership",
    example: "TRUE",
    acceptedValues: "TRUE/FALSE, YES/NO, 1/0, ใช่/ไม่ใช่",
    aliases: ["create_account", "user_account", "สร้างบัญชีผู้ใช้", "เปิดบัญชีใช้งาน"],
    adminOnly: true,
  },
  {
    key: "is_citizen_verified",
    label: "ยืนยันตัวตนแล้ว",
    required: false,
    description: "ใช้ตั้งค่าสถานะยืนยันตัวตนของผู้ใช้จากข้อมูลนำเข้า",
    example: "TRUE",
    acceptedValues: "TRUE/FALSE, YES/NO, 1/0, ใช่/ไม่ใช่",
    aliases: ["verified", "citizen_verified", "ยืนยันตัวตนแล้ว", "ตรวจสอบตัวตนแล้ว"],
    adminOnly: true,
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

// Export all columns for reference and advanced/legacy use
export const POPULATION_IMPORT_COLUMNS = ALL_POPULATION_IMPORT_COLUMNS;

// Export only admin-friendly columns (without user account/verification fields)
export const POPULATION_IMPORT_COLUMNS_ADMIN = ALL_POPULATION_IMPORT_COLUMNS.filter(
  (col) => !col.adminOnly
);

export const POPULATION_IMPORT_HEADER_ALIASES = ALL_POPULATION_IMPORT_COLUMNS.reduce<
  Record<string, string[]>
>((accumulator, column) => {
  accumulator[column.key] = [column.key, ...(column.aliases ?? [])];
  return accumulator;
}, {});

// Headers for the admin-friendly template (excludes user account fields)
export const POPULATION_IMPORT_TEMPLATE_HEADERS = POPULATION_IMPORT_COLUMNS_ADMIN.map(
  (column) => column.key,
);

// All headers including legacy fields
export const POPULATION_IMPORT_ALL_HEADERS = ALL_POPULATION_IMPORT_COLUMNS.map(
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
  occupancy_status: "มีผู้อยู่อาศัย",
  person_status: "อยู่ในทะเบียน",
  latitude: "13.7563",
  longitude: "100.5018",
  note: "หัวหน้าครัวเรือน",
};

function escapeCsvValue(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

export function buildPopulationImportTemplateCsv() {
  // Add UTF-8 BOM for proper Thai support in Excel
  const bom = "\ufeff";
  const headerLine = POPULATION_IMPORT_TEMPLATE_HEADERS.map(
    (header) => POPULATION_IMPORT_COLUMNS_ADMIN.find((col) => col.key === header)?.label ?? header
  ).join(",");
  const sampleLine = POPULATION_IMPORT_TEMPLATE_HEADERS.map((header) =>
    escapeCsvValue(POPULATION_IMPORT_SAMPLE_ROW[header] ?? ""),
  ).join(",");

  return `${bom}${headerLine}\n${sampleLine}\n`;
}

export function buildPopulationImportTemplateXlsx() {
  // Import xlsx (this is a server-side function)
  const XLSX = require("xlsx");

  // Create workbook and worksheet
  const ws_data: (string | null)[][] = [
    // Header row with Thai labels
    POPULATION_IMPORT_TEMPLATE_HEADERS.map(
      (header) => POPULATION_IMPORT_COLUMNS_ADMIN.find((col) => col.key === header)?.label ?? header
    ),
    // Sample row
    POPULATION_IMPORT_TEMPLATE_HEADERS.map((header) => POPULATION_IMPORT_SAMPLE_ROW[header] ?? ""),
    // Empty row
    [],
  ];

  const ws = XLSX.utils.aoa_to_sheet(ws_data);

  // Set column widths for better readability
  const columnWidths = POPULATION_IMPORT_TEMPLATE_HEADERS.map((header) => {
    const col = POPULATION_IMPORT_COLUMNS_ADMIN.find((c) => c.key === header);
    return { wch: Math.max(12, (col?.label ?? header).length + 2) };
  });
  ws["!cols"] = columnWidths;

  // Freeze header row
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  // Format header row as bold and with background color
  const headerCellStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "1F4E78" } }
  };

  for (let i = 0; i < POPULATION_IMPORT_TEMPLATE_HEADERS.length; i++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
    if (!ws[cellRef]) {
      ws[cellRef] = { t: "s", v: "" };
    }
    ws[cellRef].s = headerCellStyle;
  }

  // Format text columns (house_number, phone_number, national_id, external_person_id) to prevent Excel from auto-converting
  const textColumns = ["house_number", "phone_number", "national_id", "external_person_id"];
  const textColumnIndices = POPULATION_IMPORT_TEMPLATE_HEADERS
    .map((h, i) => (textColumns.includes(h) ? i : -1))
    .filter((i) => i !== -1);

  for (let rowIdx = 1; rowIdx < ws_data.length; rowIdx++) {
    for (const colIdx of textColumnIndices) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
      if (ws[cellRef]) {
        ws[cellRef].z = "@"; // Format as text
      }
    }
  }

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ข้อมูลนำเข้า");

  // Add instructions sheet
  const instructions_data = [
    ["คำแนะนำการนำเข้าข้อมูล"],
    [],
    ["ฟิลด์ที่จำเป็น:"],
    ["• เลขที่บ้าน (บังคับมี)"],
    [],
    ["การนำเข้าบุคคล:"],
    ["• หากต้องการนำเข้าบุคคล ต้องระบุ ชื่อ และ นามสกุล ให้ครบ"],
    ["• สามารถนำเข้าเฉพาะบ้าน (โดยปล่อยให้ชื่อและนามสกุลว่าง) หรือ บ้าน + บุคคล พร้อมกัน"],
    [],
    ["ข้อมูลโทรศัพท์และเลขบัตรประชาชน:"],
    ["• ตั้งค่าให้เป็น 'ข้อความ' (Text) ใน Excel เพื่อไม่ให้เลข 0 ด้านหน้าหาย"],
    ["• เลขที่บ้าน เช่น 99/12 ต้องเป็น 'ข้อความ' เพื่อไม่ให้ถูกแปลงเป็นวันที่"],
    [],
    ["ค่าที่รับได้:"],
    ["สถานะบ้าน: มีผู้อยู่อาศัย, ว่าง, กำลังก่อสร้าง, รื้อถอนแล้ว"],
    ["สถานะบุคคล: อยู่ในทะเบียน, ย้ายออก, เสียชีวิต, ไม่ทราบสถานะ"],
    ["เพศ: ชาย, หญิง, อื่นๆ"],
    [],
    ["หมายเหตุ:"],
    ["• การนำเข้าข้อมูลไม่ใช่การยืนยันตัวตนของลูกบ้าน"],
    ["• ระบบจะตรวจสอบข้อมูลเดิมก่อนสร้างรายการใหม่ เพื่อลดข้อมูลซ้ำ"],
    ["• บ้านใหม่และรายการที่เปลี่ยนแปลงจะแสดง Preview ก่อนยืนยัน"],
  ];

  const ws_instructions = XLSX.utils.aoa_to_sheet(instructions_data);
  ws_instructions["!cols"] = [{ wch: 80 }];

  XLSX.utils.book_append_sheet(wb, ws_instructions, "คำแนะนำ");

  // Generate and return Buffer
  return XLSX.write(wb, { type: "buffer" });
}
