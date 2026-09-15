export class BootstrapInputError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BootstrapInputError";
    this.code = code;
  }
}

function optionalText(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function requiredText(value, label) {
  const normalized = optionalText(value);
  if (!normalized) throw new BootstrapInputError("MISSING_INPUT", `${label} is required.`);
  return normalized;
}

export function normalizeBootstrapPhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (/^0\d{9}$/.test(digits)) return digits;
  if (/^66\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  return "";
}

/** Keep CLI slug normalization aligned with the public Village slug convention. */
export function normalizeBootstrapVillageSlug(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\u0000-\u001f\u007f\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[\\/?#[\]@!$&'()*+,;=:%"<>|`~^]+/g, "-")
    .replace(/[^a-z0-9\u0E00-\u0E7F-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function readBootstrapInput(environment = process.env) {
  const phoneNumber = normalizeBootstrapPhone(environment.BOOTSTRAP_HEADMAN_PHONE);
  if (!phoneNumber) throw new BootstrapInputError("INVALID_PHONE", "BOOTSTRAP_HEADMAN_PHONE must be a Thai 10-digit phone number.");

  return {
    headman: { phoneNumber, name: requiredText(environment.BOOTSTRAP_HEADMAN_NAME, "BOOTSTRAP_HEADMAN_NAME") },
  };
}

/** Derive the configured Village identity exclusively from its catalog record. */
export function villageFromCatalog(catalogVillage) {
  if (!catalogVillage?.id || !catalogVillage.officialCode || !catalogVillage.villageName || !catalogVillage.moo || !catalogVillage.slug || !catalogVillage.province || !catalogVillage.district || !catalogVillage.subdistrict) {
    throw new BootstrapInputError("INVALID_CATALOG_VILLAGE", "The configured catalog Village is incomplete and cannot be used for bootstrap.");
  }
  return {
    name: catalogVillage.villageName,
    slug: catalogVillage.slug,
    moo: catalogVillage.moo,
    province: catalogVillage.province,
    district: catalogVillage.district,
    subdistrict: catalogVillage.subdistrict,
    catalogVillageId: catalogVillage.id,
  };
}

export function planVillageBootstrap(activeVillages, catalogVillage) {
  if (activeVillages.length > 1) throw new BootstrapInputError("MULTIPLE_ACTIVE_VILLAGES", "Bootstrap stopped because more than one active Village exists.");
  if (activeVillages.length === 1) {
    if (activeVillages[0].catalogVillageId !== catalogVillage.id) {
      throw new BootstrapInputError("VILLAGE_CATALOG_MISMATCH", "The active Village is bound to a different catalog Village; it was not changed. Review and migrate the installation explicitly.");
    }
    return { kind: "existing", village: activeVillages[0] };
  }
  return { kind: "create", village: villageFromCatalog(catalogVillage) };
}
