import {
  MembershipStatus,
  SystemRole,
  VillageMembershipRole,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  updateUserRoleAction,
  upsertPhoneRoleSeedAction,
  registerAdminAction,
} from "./actions";
import { getThaiGeographyHierarchy } from "@/lib/thai-geography";
import { DevVillageForm } from "./dev-village-form";

export const dynamic = "force-dynamic";

export default async function DevPage() {
  const thaiGeography = getThaiGeographyHierarchy();

  const [villages, users, seeds, adminCounts] = await Promise.all([
    prisma.village.findMany({
      orderBy: [{ province: "asc" }, { district: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        province: true,
        district: true,
        subdistrict: true,
        isActive: true,
      },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        memberships: {
          include: {
            village: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      take: 100,
    }),
    prisma.phoneRoleSeed.findMany({
      include: {
        village: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    // Get admin counts per village
    prisma.village.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            memberships: {
              where: {
                role: VillageMembershipRole.HEADMAN,
                status: MembershipStatus.ACTIVE,
              },
            },
          },
        },
      },
    }).then(async (vills) => {
      const result: Record<string, { headman: number; assistant: number }> = {};
      for (const v of vills) {
        const headmanCount = v._count.memberships;
        const assistantCount = await prisma.villageMembership.count({
          where: {
            villageId: v.id,
            role: VillageMembershipRole.ASSISTANT_HEADMAN,
            status: MembershipStatus.ACTIVE,
          },
        });
        result[v.id] = { headman: headmanCount, assistant: assistantCount };
      }
      return result;
    }),
  ]);

  const systemRoleOptions = Object.values(SystemRole) as SystemRole[];
  const membershipRoleOptions = Object.values(
    VillageMembershipRole
  ) as VillageMembershipRole[];
  const membershipStatusOptions = Object.values(
    MembershipStatus
  ) as MembershipStatus[];

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dev Control Panel</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage users, roles, villages, and phone-based citizen verification seeds.
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">1) Village Source Data</h2>
        <p className="mt-1 text-sm text-gray-500">
          Setup province, district, subdistrict, and village list for signup dropdowns.
        </p>
        <DevVillageForm thaiGeography={thaiGeography} villages={villages} />

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-600">
                <th className="px-3 py-2">Village</th>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {villages.map((village) => (
                <tr key={village.id} className="border-b">
                  <td className="px-3 py-2">{village.name}</td>
                  <td className="px-3 py-2 text-gray-600">{village.slug}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {[village.subdistrict, village.district, village.province]
                      .filter(Boolean)
                      .join(" / ")}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        village.isActive
                          ? "rounded-full bg-green-100 px-2 py-1 text-xs text-green-700"
                          : "rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600"
                      }
                    >
                      {village.isActive ? "active" : "inactive"}
                    </span>
                  </td>
                </tr>
              ))}
              {villages.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-gray-500" colSpan={4}>
                    No village data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">2) Phone Role Seed</h2>
        <p className="mt-1 text-sm text-gray-500">
          Add role by phone number. Use HEADMAN role for village headman phone.
        </p>
        <form action={upsertPhoneRoleSeedAction} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            name="phoneNumber"
            required
            placeholder="Phone (+66...)"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <select name="villageId" className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">No village</option>
            {villages.map((village) => (
              <option key={village.id} value={village.id}>
                {village.name} ({village.slug})
              </option>
            ))}
          </select>
          <select
            name="membershipRole"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            defaultValue={VillageMembershipRole.RESIDENT}
          >
            {membershipRoleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <select name="systemRole" className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">No system override</option>
            {systemRoleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <input
            name="note"
            placeholder="Note (optional)"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">
            <input type="checkbox" name="isCitizenVerified" defaultChecked />
            citizen verified
          </label>
          <button
            type="submit"
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 md:col-span-3"
          >
            Add / Update Phone Seed
          </button>
        </form>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-600">
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Village</th>
                <th className="px-3 py-2">Membership Role</th>
                <th className="px-3 py-2">System Role</th>
                <th className="px-3 py-2">Citizen Verified</th>
                <th className="px-3 py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {seeds.map((seed) => (
                <tr key={seed.id} className="border-b">
                  <td className="px-3 py-2 font-mono">{seed.phoneNumber}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {seed.village ? `${seed.village.name} (${seed.village.slug})` : "-"}
                  </td>
                  <td className="px-3 py-2">{seed.membershipRole}</td>
                  <td className="px-3 py-2">{seed.systemRole ?? "-"}</td>
                  <td className="px-3 py-2">{seed.isCitizenVerified ? "yes" : "no"}</td>
                  <td className="px-3 py-2 text-gray-600">{seed.note ?? "-"}</td>
                </tr>
              ))}
              {seeds.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-gray-500" colSpan={6}>
                    No phone seed data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">3) User and Role Management</h2>
        <p className="mt-1 text-sm text-gray-500">
          Update system role and active membership mapping per user.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-600">
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Citizen</th>
                <th className="px-3 py-2">Update Roles</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const currentMembership = user.memberships[0];
                return (
                  <tr key={user.id} className="border-b align-top">
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.id}</p>
                    </td>
                    <td className="px-3 py-2 font-mono">{user.phoneNumber}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {user.citizenVerifiedAt ? "verified" : "pending"}
                    </td>
                    <td className="px-3 py-2">
                      <form action={updateUserRoleAction} className="grid gap-2 md:grid-cols-4">
                        <input type="hidden" name="userId" value={user.id} />
                        <select
                          name="systemRole"
                          className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                          defaultValue={user.systemRole}
                        >
                          {systemRoleOptions.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                        <select
                          name="villageId"
                          className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                          defaultValue={currentMembership?.villageId ?? ""}
                        >
                          <option value="">No membership</option>
                          {villages.map((village) => (
                            <option key={village.id} value={village.id}>
                              {village.name}
                            </option>
                          ))}
                        </select>
                        <select
                          name="membershipRole"
                          className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                          defaultValue={currentMembership?.role ?? VillageMembershipRole.RESIDENT}
                        >
                          {membershipRoleOptions.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                        <select
                          name="membershipStatus"
                          className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                          defaultValue={currentMembership?.status ?? MembershipStatus.ACTIVE}
                        >
                          {membershipStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="rounded-lg bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-black md:col-span-4"
                        >
                          Save User Role Mapping
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-gray-500" colSpan={4}>
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">4) Admin Registration</h2>
        <p className="mt-1 text-sm text-gray-500">
          Register new admin accounts with household info and role assignment.
        </p>

        <div className="mt-4">
          <form action={registerAdminAction} className="grid gap-3 md:grid-cols-4">
            <input
              type="tel"
              name="phoneNumber"
              placeholder="Phone number"
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              name="adminName"
              placeholder="First name"
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              name="lastName"
              placeholder="Last name"
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <select
              name="villageId"
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">-- Select Village --</option>
              {villages.map((village) => (
                <option key={village.id} value={village.id}>
                  {village.name} ({village.district})
                </option>
              ))}
            </select>
            <input
              type="text"
              name="houseNumber"
              placeholder="House number (optional)"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              name="nationalId"
              placeholder="National ID (optional)"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <select
              name="membershipRole"
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value={VillageMembershipRole.RESIDENT}>Resident</option>
              <option value={VillageMembershipRole.ASSISTANT_HEADMAN}>
                Assistant Headman
              </option>
              <option value={VillageMembershipRole.HEADMAN}>Headman</option>
            </select>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 md:col-span-3"
            >
              Register Admin
            </button>
          </form>

          <div className="mt-6">
            <h3 className="font-semibold text-gray-900">Current Admin Counts per Village</h3>
            <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {villages.map((village) => {
                const counts = adminCounts[village.id];
                if (!counts) return null;
                return (
                  <div key={village.id} className="rounded border border-gray-200 bg-gray-50 p-3">
                    <p className="font-medium text-gray-900">{village.name}</p>
                    <p className="text-xs text-gray-600">
                      Headmen: {counts.headman}/1 | Assistants: {counts.assistant}/2
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
