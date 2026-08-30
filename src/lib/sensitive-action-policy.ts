export const SENSITIVE_ACTIONS = [
  "binding.approve",
  "binding.reject",
  "binding.override_mismatch",
  "population.house.create",
  "population.house.edit",
  "population.house.delete",
  "population.person.create",
  "population.person.edit",
  "population.person.move_out",
  "population.person.deactivate",
  "population.person.delete",
  "population.import",
  "population.import.rollback",
  "population.export_sensitive",
  "member.suspend",
  "member.reactivate",
  "member.role.assign",
  "member.role.remove",
  "village.settings.update",
  "content.delete",
  "content.unpublish",
  "content.archive",
  "content.request.reject",
  "issue.close",
  "issue.reject",
  "issue.cancel",
  "appointment.cancel",
  "appointment.reject_time",
] as const;

export type SensitiveAction = (typeof SENSITIVE_ACTIONS)[number];

export type ActionPolicy = Readonly<{
  requiresReason: boolean;
  minReasonLength: number;
  audit: boolean;
  notifyAffectedUser: boolean;
}>;

const ROUTINE: ActionPolicy = { requiresReason: false, minReasonLength: 0, audit: true, notifyAffectedUser: false };
const ROUTINE_NOTIFY: ActionPolicy = { ...ROUTINE, notifyAffectedUser: true };
const REASON: ActionPolicy = { requiresReason: true, minReasonLength: 5, audit: true, notifyAffectedUser: false };
const REASON_NOTIFY: ActionPolicy = { ...REASON, notifyAffectedUser: true };

/** Central policy for meaningful admin actions; domain workflows consume notification intent. */
export const ACTION_POLICIES: Readonly<Record<SensitiveAction, ActionPolicy>> = {
  "binding.approve": ROUTINE_NOTIFY,
  "binding.reject": REASON_NOTIFY,
  "binding.override_mismatch": REASON_NOTIFY,
  "population.house.create": ROUTINE,
  "population.house.edit": ROUTINE,
  "population.house.delete": REASON,
  "population.person.create": ROUTINE,
  "population.person.edit": ROUTINE,
  "population.person.move_out": REASON,
  "population.person.deactivate": REASON,
  "population.person.delete": REASON,
  "population.import": REASON,
  "population.import.rollback": REASON,
  "population.export_sensitive": REASON,
  "member.suspend": REASON_NOTIFY,
  "member.reactivate": REASON_NOTIFY,
  "member.role.assign": REASON_NOTIFY,
  "member.role.remove": REASON_NOTIFY,
  "village.settings.update": ROUTINE,
  "content.delete": REASON,
  "content.unpublish": REASON,
  "content.archive": REASON,
  "content.request.reject": REASON_NOTIFY,
  "issue.close": REASON_NOTIFY,
  "issue.reject": REASON_NOTIFY,
  "issue.cancel": REASON_NOTIFY,
  "appointment.cancel": REASON_NOTIFY,
  "appointment.reject_time": REASON_NOTIFY,
};

export function getActionPolicy(action: SensitiveAction): ActionPolicy {
  return ACTION_POLICIES[action];
}

export class ActionReasonError extends Error {
  readonly action: SensitiveAction;

  constructor(action: SensitiveAction, message: string) {
    super(message);
    this.action = action;
    this.name = "ActionReasonError";
  }
}

/** Authoritative server-compatible normalization and validation. */
export function requireActionReason(action: SensitiveAction, input: unknown): string {
  const policy = getActionPolicy(action);
  const reason = typeof input === "string" ? input.trim() : "";
  if (policy.requiresReason && reason.length < policy.minReasonLength) {
    throw new ActionReasonError(action, `กรุณาระบุเหตุผลอย่างน้อย ${policy.minReasonLength} ตัวอักษร`);
  }
  return reason;
}
