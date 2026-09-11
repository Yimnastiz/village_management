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

  const rawSlug = optionalText(environment.BOOTSTRAP_VILLAGE_SLUG);
  const slug = rawSlug ? normalizeBootstrapVillageSlug(rawSlug) : null;
  if (rawSlug && !slug) throw new BootstrapInputError("INVALID_SLUG", "BOOTSTRAP_VILLAGE_SLUG is empty or unsafe after normalization.");

  return {
    headman: { phoneNumber, name: requiredText(environment.BOOTSTRAP_HEADMAN_NAME, "BOOTSTRAP_HEADMAN_NAME") },
    village: {
      name: optionalText(environment.BOOTSTRAP_VILLAGE_NAME), slug, moo: optionalText(environment.BOOTSTRAP_VILLAGE_MOO),
      province: optionalText(environment.BOOTSTRAP_VILLAGE_PROVINCE), district: optionalText(environment.BOOTSTRAP_VILLAGE_DISTRICT), subdistrict: optionalText(environment.BOOTSTRAP_VILLAGE_SUBDISTRICT),
    },
  };
}

function requireVillageCreationInput(village) {
  for (const [field, variable] of [["name", "BOOTSTRAP_VILLAGE_NAME"], ["slug", "BOOTSTRAP_VILLAGE_SLUG"], ["moo", "BOOTSTRAP_VILLAGE_MOO"], ["province", "BOOTSTRAP_VILLAGE_PROVINCE"], ["district", "BOOTSTRAP_VILLAGE_DISTRICT"], ["subdistrict", "BOOTSTRAP_VILLAGE_SUBDISTRICT"]]) {
    if (!village[field]) throw new BootstrapInputError("MISSING_VILLAGE_INPUT", `${variable} is required when no active Village exists.`);
  }
  return village;
}

function verifyProvidedVillageIdentity(activeVillage, requestedVillage) {
  for (const field of ["name", "slug", "moo", "province", "district", "subdistrict"]) {
    if (requestedVillage[field] && requestedVillage[field] !== activeVillage[field]) {
      throw new BootstrapInputError("VILLAGE_MISMATCH", `The supplied Village ${field} does not match the configured active Village.`);
    }
  }
}

export function planVillageBootstrap(activeVillages, requestedVillage) {
  if (activeVillages.length > 1) throw new BootstrapInputError("MULTIPLE_ACTIVE_VILLAGES", "Bootstrap stopped because more than one active Village exists.");
  if (activeVillages.length === 1) {
    verifyProvidedVillageIdentity(activeVillages[0], requestedVillage);
    return { kind: "existing", village: activeVillages[0] };
  }
  return { kind: "create", village: requireVillageCreationInput(requestedVillage) };
}
