export type MemberRole = "HEADMAN" | "ASSISTANT_HEADMAN" | "RESIDENT";
export type MemberStatus = "ACTIVE" | "PENDING" | "SUSPENDED" | "REJECTED";

export type MemberRow = {
  id: string;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: string | null;
  updatedAt: string;
  houseId: string | null;
  house: { houseNumber: string } | null;
  user: { id: string; name: string; phoneNumber: string; accountStatus: string };
};

export type HouseOption = { id: string; houseNumber: string };

export type MemberQueryRow = Omit<MemberRow, "joinedAt" | "updatedAt"> & { joinedAt: Date | null; updatedAt: Date };
