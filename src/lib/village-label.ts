function normalizedMoo(moo: string | number | null | undefined): number | null {
  const parsed = Number.parseInt(String(moo ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function formatVillageLabel(name: string, moo?: string | number | null): string {
  const parsedMoo = normalizedMoo(moo);
  return parsedMoo ? `หมู่ ${parsedMoo} - ${name}` : name;
}

export function villageSearchText(input: {
  name: string;
  moo?: string | number | null;
  officialCode?: string | null;
  province?: string | null;
  district?: string | null;
  subdistrict?: string | null;
}): string {
  const parsedMoo = normalizedMoo(input.moo);
  return [
    formatVillageLabel(input.name, parsedMoo),
    input.name,
    parsedMoo ? `หมู่ ${parsedMoo}` : "",
    parsedMoo ? `ม.${parsedMoo}` : "",
    parsedMoo ? String(parsedMoo) : "",
    input.officialCode ?? "",
    input.subdistrict ?? "",
    input.district ?? "",
    input.province ?? "",
  ].filter(Boolean).join(" ");
}
