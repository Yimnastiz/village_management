"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminActionSession } from "@/lib/superadmin";
import { prisma } from "@/lib/prisma";
import { notifyVillageAdministrationOfSuperAdminIntervention } from "@/lib/superadmin-village-intervention";
import {
  createVillageHouse,
  createVillageHouses,
  createVillagePerson,
  deleteVillageHouse,
  markVillagePersonDeceased,
  moveOutVillagePerson,
  PopulationBatchValidationError,
  PopulationValidationError,
  updateVillageHouse,
  updateVillagePerson,
  type VillagePersonInput,
} from "@/features/population/server/village-population-service";

export type PopulationActionResult =
  | {
      success: true;
      id?: string;
      message: string;
    }
  | {
      success: false;
      error: string;
    };

type BatchPopulationActionResult =
  | {
      success: true;
      count: number;
      message: string;
    }
  | {
      success: false;
      error?: string;
      errors?: Array<{
        index: number;
        field: "houseNumber" | "address";
        message: string;
      }>;
    };

const SUPPORT_REASON_MIN_LENGTH = 5;
const SUPPORT_REASON_MAX_LENGTH = 500;

function requireSupportReason(reason: unknown): string {
  const value = typeof reason === "string" ? reason.trim() : "";

  if (value.length < SUPPORT_REASON_MIN_LENGTH) {
    throw new PopulationValidationError(
      `กรุณาระบุเหตุผลในการดำเนินการอย่างน้อย ${SUPPORT_REASON_MIN_LENGTH} ตัวอักษร`,
    );
  }

  if (value.length > SUPPORT_REASON_MAX_LENGTH) {
    throw new PopulationValidationError(
      `เหตุผลในการดำเนินการต้องไม่เกิน ${SUPPORT_REASON_MAX_LENGTH} ตัวอักษร`,
    );
  }

  return value;
}

function errorMessage(error: unknown): string {
  if (error instanceof PopulationValidationError) {
    return error.message;
  }

  console.error("[superadmin][population] action failed", {
    errorName: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : undefined,
  });

  return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
}

function refresh(
  villageId: string,
  resource: "houses" | "people",
  id?: string,
) {
  const villageBase = `/superadmin/villages/${villageId}`;
  const resourceBase = `${villageBase}/${resource}`;

  revalidatePath(resourceBase);

  if (id) {
    revalidatePath(`${resourceBase}/${id}`);
  }

  revalidatePath(`${villageBase}/overview`);
  revalidatePath(`${villageBase}/audit`);
}

async function notifyIntervention(input: Parameters<typeof notifyVillageAdministrationOfSuperAdminIntervention>[1]) {
  await prisma.$transaction((tx) => notifyVillageAdministrationOfSuperAdminIntervention(tx, input));
}

/**
 * Super Admin mutations inside a village workspace must always include
 * an explicit support reason.
 *
 * The support reason is intentionally validated in the server action,
 * even when the client also validates it, so the policy cannot be
 * bypassed by calling the action directly.
 */
export async function createSuperAdminHouseAction(
  villageId: string,
  formData: FormData,
): Promise<PopulationActionResult> {
  try {
    const actor = await requireSuperAdminActionSession();
    const supportReason = requireSupportReason(formData.get("reason"));

    const row = await createVillageHouse(
      villageId,
      {
        houseNumber: String(
        formData.get("houseNumber") ?? "",
        ),
        address: String(
          formData.get("address") ?? "",
        ),
      },
  actor,
  {
    supportReason,
  },
);

    await notifyIntervention({ villageId, actionLabel: "เพิ่มข้อมูลบ้าน", supportReason, targetType: "House", targetId: row.id, targetName: `บ้านเลขที่ ${String(formData.get("houseNumber") ?? "").trim()}`, actionUrl: `/admin/population/houses/${row.id}`, metadata: { houseId: row.id } });

    refresh(villageId, "houses", row.id);

    return {
      success: true,
      id: row.id,
      message: "เพิ่มบ้านสำเร็จ",
    };
  } catch (error) {
    return {
      success: false,
      error: errorMessage(error),
    };
  }
}

export async function createSuperAdminHousesAction(
  villageId: string,
  items: Array<{
    houseNumber: string;
    address?: string;
  }>,
  reason?: string,
): Promise<BatchPopulationActionResult> {
  try {
    const actor = await requireSuperAdminActionSession();
    const supportReason = requireSupportReason(reason);

    const houses = await createVillageHouses(
      villageId,
      items,
      actor,
      {
        supportReason,
      },
);

    await notifyIntervention({ villageId, actionLabel: `เพิ่มข้อมูลบ้านจำนวน ${houses.length} หลัง`, supportReason, targetType: "House", actionUrl: "/admin/population/houses", metadata: { batchCount: houses.length } });

    refresh(villageId, "houses");

    return {
      success: true,
      count: houses.length,
      message:
        houses.length === 1
          ? "เพิ่มบ้านเรียบร้อยแล้ว"
          : `เพิ่มบ้าน ${houses.length} หลังเรียบร้อยแล้ว`,
    };
  } catch (error) {
    if (error instanceof PopulationBatchValidationError) {
      return {
        success: false,
        errors: error.errors,
      };
    }

    if (error instanceof PopulationValidationError) {
      return {
        success: false,
        error: error.message,
      };
    }

    console.error("[superadmin][population] create houses failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : undefined,
    });

    return {
      success: false,
      error: "ไม่สามารถเพิ่มบ้านได้ กรุณาลองใหม่อีกครั้ง",
    };
  }
}

export async function updateSuperAdminHouseAction(
  villageId: string,
  houseId: string,
  formData: FormData,
): Promise<PopulationActionResult> {
  try {
    const actor = await requireSuperAdminActionSession();
    const supportReason = requireSupportReason(formData.get("reason"));

    const result = await updateVillageHouse(
      villageId,
      houseId,
      {
        houseNumber: String(
          formData.get("houseNumber") ?? "",
        ),
        address: String(
          formData.get("address") ?? "",
        ),
      },
      actor,
      {
        supportReason,
      },
);

    await notifyIntervention({ villageId, actionLabel: result.statusChanged ? "เปลี่ยนสถานะบ้าน" : "แก้ไขข้อมูลบ้าน", supportReason, targetType: "House", targetId: houseId, targetName: `บ้านเลขที่ ${String(formData.get("houseNumber") ?? "").trim()}`, actionUrl: `/admin/population/houses/${houseId}`, metadata: { houseId } });

    refresh(villageId, "houses", houseId);

    return {
      success: true,
      message: result.statusChanged
        ? "เปลี่ยนสถานะบ้านสำเร็จ"
        : "แก้ไขบ้านสำเร็จ",
    };
  } catch (error) {
    return {
      success: false,
      error: errorMessage(error),
    };
  }
}

export async function createSuperAdminPersonAction(
  villageId: string,
  data: VillagePersonInput,
): Promise<PopulationActionResult> {
  try {
    const actor = await requireSuperAdminActionSession();
    const supportReason = requireSupportReason(data.reason);

    const row = await createVillagePerson(
      villageId,
      {
        ...data,
        reason: supportReason,
      },
      actor,
      { supportReason },
    );

    await notifyIntervention({ villageId, actionLabel: "เพิ่มข้อมูลบุคคล", supportReason, targetType: "Person", targetId: row.id, targetName: `${data.firstName} ${data.lastName}`.trim(), actionUrl: `/admin/population/people/${row.id}`, metadata: { personId: row.id } });

    refresh(villageId, "people", row.id);

    return {
      success: true,
      id: row.id,
      message: "เพิ่มบุคคลสำเร็จ",
    };
  } catch (error) {
    return {
      success: false,
      error: errorMessage(error),
    };
  }
}

export async function updateSuperAdminPersonAction(
  villageId: string,
  personId: string,
  data: VillagePersonInput,
): Promise<PopulationActionResult> {
  try {
    const actor = await requireSuperAdminActionSession();
    const supportReason = requireSupportReason(data.reason);

    const result = await updateVillagePerson(
      villageId,
      personId,
      {
        ...data,
        reason: supportReason,
      },
      actor,
    );

    await notifyIntervention({ villageId, actionLabel: result.moved ? "ย้ายบ้านของบุคคล" : "แก้ไขข้อมูลบุคคล", supportReason, targetType: "Person", targetId: personId, targetName: `${data.firstName} ${data.lastName}`.trim(), actionUrl: `/admin/population/people/${personId}`, metadata: { personId } });

    refresh(villageId, "people", personId);

    return {
      success: true,
      message: result.moved
        ? "ย้ายบ้านสำเร็จ"
        : "แก้ไขข้อมูลประชากรสำเร็จ",
    };
  } catch (error) {
    return {
      success: false,
      error: errorMessage(error),
    };
  }
}

export async function moveOutSuperAdminPersonAction(
  villageId: string,
  personId: string,
  reason: string,
): Promise<PopulationActionResult> {
  try {
    const actor = await requireSuperAdminActionSession();
    const supportReason = requireSupportReason(reason);

    await moveOutVillagePerson(
      villageId,
      personId,
      supportReason,
      actor,
    );

    await notifyIntervention({ villageId, actionLabel: "บันทึกการย้ายออกของบุคคล", supportReason, targetType: "Person", targetId: personId, actionUrl: `/admin/population/people/${personId}`, metadata: { personId } });

    refresh(villageId, "people", personId);

    return {
      success: true,
      message: "ย้ายประชากรออกจากทะเบียนสำเร็จ",
    };
  } catch (error) {
    return {
      success: false,
      error: errorMessage(error),
    };
  }
}

export async function deleteSuperAdminHouseAction(villageId: string, houseId: string, reason: string): Promise<PopulationActionResult> {
  try {
    const actor = await requireSuperAdminActionSession();
    const supportReason = requireSupportReason(reason);
    await deleteVillageHouse(villageId, houseId, supportReason, actor);
    await notifyIntervention({ villageId, actionLabel: "ลบข้อมูลบ้าน", supportReason, targetType: "House", targetId: houseId, actionUrl: "/admin/population/houses", metadata: { houseId } });
    refresh(villageId, "houses");
    return { success: true, message: "ลบบ้านสำเร็จ" };
  } catch (error) { return { success: false, error: errorMessage(error) }; }
}

export async function markSuperAdminPersonDeceasedAction(villageId: string, personId: string, date: string, reason: string): Promise<PopulationActionResult> {
  try {
    const actor = await requireSuperAdminActionSession();
    const supportReason = requireSupportReason(reason);
    await markVillagePersonDeceased(villageId, personId, date, supportReason, actor);
    await notifyIntervention({ villageId, actionLabel: "บันทึกการเสียชีวิตของบุคคล", supportReason, targetType: "Person", targetId: personId, actionUrl: `/admin/population/people/${personId}`, metadata: { personId } });
    refresh(villageId, "people", personId);
    revalidatePath(`/superadmin/villages/${villageId}/houses`);
    return { success: true, message: "บันทึกสถานะเสียชีวิตแล้ว" };
  } catch (error) { return { success: false, error: errorMessage(error) }; }
}

export async function deleteSuperAdminHouseFormAction(villageId: string, houseId: string, formData: FormData): Promise<void> {
  await deleteSuperAdminHouseAction(villageId, houseId, String(formData.get("supportReason") ?? ""));
}

export async function markSuperAdminPersonDeceasedFormAction(villageId: string, personId: string, formData: FormData) {
  return markSuperAdminPersonDeceasedAction(villageId, personId, String(formData.get("date") ?? ""), String(formData.get("supportReason") ?? ""));
}
