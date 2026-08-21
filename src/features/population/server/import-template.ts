import { POPULATION_EVENT_THAI_OPTIONS } from "./import-value-parsers";

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
    description: "กรอกเป็น วัน-เดือน-ปี พ.ศ. เช่น 12-08-2547 (ใช้ / แทน - ได้)",
    example: "12-08-2547",
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
    label: "พื้นที่/คุ้ม",
    required: false,
    description: "พื้นที่ย่อยหรือคุ้มภายในหมู่บ้าน ใช้สร้างหรือจับคู่พื้นที่ของบ้านอัตโนมัติ",
    example: "คุ้มเหนือ",
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
    label: "เหตุการณ์ประชากร",
    required: false,
    description: "เลือกเหตุการณ์จากรายการ",
    example: "ย้ายเข้า",
    acceptedValues: "ย้ายเข้า, ย้ายออก, เกิด, เสียชีวิต, ย้ายภายใน",
    aliases: ["movement", "movement type", "ประเภทการย้าย", "เหตุการณ์ประชากร"],
  },
  {
    key: "movement_date",
    label: "วันที่เกิดเหตุการณ์",
    required: false,
    description: "กรอกเป็น วัน-เดือน-ปี พ.ศ. เช่น 01-08-2569 (ใช้ / แทน - ได้)",
    example: "01-08-2569",
    aliases: ["movement date", "วันที่ย้าย", "วันที่เกิดเหตุการณ์"],
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

// The normal template deliberately omits the legacy migration identifier.
export const POPULATION_IMPORT_TEMPLATE_HEADERS = POPULATION_IMPORT_COLUMNS_ADMIN
  .filter((column) => column.key !== "external_person_id")
  .map((column) => column.key);

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
  date_of_birth: "12-08-2547",
  gender: "ชาย",
  email: "somchai@example.com",
  house_address: "99/12 หมู่ 4 ถนนกลางหมู่บ้าน",
  zone_name: "คุ้มเหนือ",
  occupancy_status: "มีผู้อยู่อาศัย",
  person_status: "อยู่ในทะเบียน",
  movement_type: "ย้ายเข้า",
  movement_date: "01-08-2569",
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

  // Text format prevents lost zeroes, 99/12 becoming a date, and Buddhist Era dates being reformatted.
  const textColumns = ["house_number", "phone_number", "national_id", "date_of_birth", "movement_date"];
  const textColumnIndices = POPULATION_IMPORT_TEMPLATE_HEADERS
    .map((h, i) => (textColumns.includes(h) ? i : -1))
    .filter((i) => i !== -1);

  for (let rowIdx = 1; rowIdx <= 1000; rowIdx++) {
    for (const colIdx of textColumnIndices) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
      ws[cellRef] ??= { t: "s", v: "" };
      ws[cellRef].z = "@";
    }
  }

  const validationValues: Record<string, string[]> = {
    gender: ["ชาย", "หญิง", "ไม่ระบุ"],
    person_status: ["อยู่ในทะเบียน", "ย้ายออก", "เสียชีวิต", "ไม่ทราบสถานะ"],
    occupancy_status: ["มีผู้อยู่อาศัย", "ว่าง", "กำลังก่อสร้าง", "รื้อถอนแล้ว"],
    movement_type: [...POPULATION_EVENT_THAI_OPTIONS],
  };
  const dataValidations = Object.entries(validationValues).map(([key, values]) => {
    const columnIndex = POPULATION_IMPORT_TEMPLATE_HEADERS.indexOf(key);
    const column = XLSX.utils.encode_col(columnIndex);
    return `<dataValidation type="list" allowBlank="1" showErrorMessage="1" showInputMessage="1" sqref="${column}2:${column}1001"><formula1>&quot;${values.join(",")}&quot;</formula1></dataValidation>`;
  }).join("");

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ข้อมูลนำเข้า");

  // Add concise Thai-first instructions; legacy migration fields are intentionally not shown.
  const instructions_data = [
    ["คำแนะนำ"],
    [],
    ["ช่อง", "จำเป็น", "วิธีกรอก", "ตัวอย่าง / ค่าที่เลือกได้"],
    ["เลขที่บ้าน", "จำเป็น", "ข้อความ", "99/12"],
    ["ชื่อ", "เมื่อเพิ่มบุคคล", "กรอกพร้อมนามสกุล", "สมชาย"],
    ["นามสกุล", "เมื่อเพิ่มบุคคล", "กรอกพร้อมชื่อ", "ใจดี"],
    ["วันเกิด", "ไม่จำเป็น", "วัน-เดือน-ปี พ.ศ. (เป็นข้อความ)", "12-08-2547 หรือ 12/08/2547"],
    ["เพศ", "ไม่จำเป็น", "เลือกจากรายการ", "ชาย, หญิง, ไม่ระบุ"],
    ["สถานะบุคคล", "ไม่จำเป็น", "เลือกจากรายการ", "อยู่ในทะเบียน, ย้ายออก, เสียชีวิต, ไม่ทราบสถานะ"],
    ["สถานะบ้าน", "ไม่จำเป็น", "เลือกจากรายการ", "มีผู้อยู่อาศัย, ว่าง, กำลังก่อสร้าง, รื้อถอนแล้ว"],
    ["เหตุการณ์ประชากร", "ไม่จำเป็น", "เลือกจากรายการ", "ย้ายเข้า, ย้ายออก, เกิด, เสียชีวิต, ย้ายภายใน"],
    ["วันที่เกิดเหตุการณ์", "เมื่อมีเหตุการณ์", "วัน-เดือน-ปี พ.ศ. (เป็นข้อความ)", "01-08-2569 หรือ 01/08/2569"],
    ["พื้นที่/คุ้ม", "ไม่จำเป็น", "พื้นที่ย่อยภายในหมู่บ้าน", "คุ้มเหนือ"],
    [],
    ["หมายเหตุ", "", "แถวตัวอย่างมีไว้ดูวิธีกรอกเท่านั้น ไม่ใช่ข้อมูลจริง", "กรอกข้อมูลตั้งแต่แถวถัดไป"],
  ];

  const ws_instructions = XLSX.utils.aoa_to_sheet(instructions_data);
  ws_instructions["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 42 }, { wch: 58 }];

  XLSX.utils.book_append_sheet(wb, ws_instructions, "คำแนะนำ");

  // SheetJS CE preserves styles but does not write data validations. Inject the
  // standard SpreadsheetML element so Excel shows native dropdowns.
  const CFB = require("cfb");
  const archive = CFB.read(XLSX.write(wb, { type: "buffer" }), { type: "buffer" });
  const worksheet = archive.FileIndex[archive.FullPaths.indexOf("Root Entry/xl/worksheets/sheet1.xml")];
  if (!worksheet?.content) throw new Error("ไม่สามารถสร้างรายการเลือกในแบบฟอร์ม Excel ได้");
  const worksheetXml = Buffer.from(worksheet.content).toString("utf8");
  const validationsXml = `<dataValidations count="${Object.keys(validationValues).length}">${dataValidations}</dataValidations>`;
  let withValidations = worksheetXml.replace("</sheetData>", `</sheetData>${validationsXml}`);
  for (const columnIndex of textColumnIndices) {
    const excelColumnNumber = columnIndex + 1;
    withValidations = withValidations.replace(
      new RegExp(`<col min="${excelColumnNumber}" max="${excelColumnNumber}"`),
      `<col min="${excelColumnNumber}" max="${excelColumnNumber}" style="1"`,
    );
  }
  worksheet.content = Buffer.from(withValidations, "utf8");
  worksheet.size = worksheet.content.length;
  return CFB.write(archive, { type: "buffer", fileType: "zip", compression: true });
}
