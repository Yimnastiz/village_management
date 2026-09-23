export const MAX_HOUSE_ACCOUNT_EMAILS = 10;

export function canAddAccountEmail(activeCount: number): boolean {
  return Number.isInteger(activeCount) && activeCount >= 0 && activeCount < MAX_HOUSE_ACCOUNT_EMAILS;
}

export function canRemoveAccountEmail(activeCount: number): boolean {
  return Number.isInteger(activeCount) && activeCount > 1;
}

export function chooseCanonicalReplacement<T extends { activatedAt: Date | null; createdAt: Date; id: string }>(
  emails: readonly T[],
): T | null {
  return [...emails].sort((left, right) => {
    const leftTime = left.activatedAt?.getTime() ?? left.createdAt.getTime();
    const rightTime = right.activatedAt?.getTime() ?? right.createdAt.getTime();
    return leftTime - rightTime || left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id);
  })[0] ?? null;
}
