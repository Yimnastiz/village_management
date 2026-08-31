export type MemberRole = "HEADMAN" | "ASSISTANT_HEADMAN" | "RESIDENT";
export type MemberStatus = "ACTIVE" | "PENDING" | "SUSPENDED" | "REJECTED" | "LEFT";

export type MemberRow = {
  id: string;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: string | null;
  houseId: string | null;
  house: { houseNumber: string } | null;
  user: { id: string; name: string; phoneNumber: string; accountStatus: string };
};

export type HouseOption = { id: string; houseNumber: string };

export type MemberQueryRow = Omit<MemberRow, "joinedAt"> & { joinedAt: Date | null };
