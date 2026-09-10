export class ConfiguredVillageError extends Error {
  constructor(code) {
    super(code === "MISSING" ? "No active Village is configured for this installation." : "More than one active Village is configured for this installation.");
    this.name = "ConfiguredVillageError";
    this.code = code;
  }
}

export function resolveConfiguredVillage(villages) {
  if (villages.length === 0) throw new ConfiguredVillageError("MISSING");
  if (villages.length > 1) throw new ConfiguredVillageError("MULTIPLE");
  return villages[0];
}
