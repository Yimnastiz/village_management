import { MembershipStatus, VillageMembershipRole } from "@prisma/client";

export const ACCESS_MEMBERSHIP_STATUSES = [MembershipStatus.ACTIVE, MembershipStatus.SUSPENDED] as const;
export const ACCESS_MEMBERSHIP_ROLES = [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN, VillageMembershipRole.COMMITTEE, VillageMembershipRole.RESIDENT] as const;

export function isAccessMembershipStatus(status: MembershipStatus): status is typeof ACCESS_MEMBERSHIP_STATUSES[number] {
  return status === MembershipStatus.ACTIVE || status === MembershipStatus.SUSPENDED;
}

/** Request status never grants access; only the actual membership relationship does. */
export function belongsInAccessManagement(membershipStatus: MembershipStatus | null | undefined) {
  return membershipStatus ? isAccessMembershipStatus(membershipStatus) : false;
}

export function isRequestPlaceholderStatus(status: MembershipStatus) {
  return status === MembershipStatus.PENDING || status === MembershipStatus.REJECTED;
}
