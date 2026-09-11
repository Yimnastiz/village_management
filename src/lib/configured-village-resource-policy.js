/**
 * Storage keys are namespaced by Village.  Public lookup routes must not turn
 * a key from a legacy Village into a cross-Village read capability.
 */
export function belongsToConfiguredVillageResource(key, namespace, villageId) {
  return Boolean(
    typeof key === "string" &&
      typeof namespace === "string" &&
      typeof villageId === "string" &&
      villageId.length > 0 &&
      key.startsWith(`${namespace}/${villageId}/`)
  );
}

export function belongsToConfiguredVillage(recordVillageId, configuredVillageId) {
  return recordVillageId === configuredVillageId;
}
