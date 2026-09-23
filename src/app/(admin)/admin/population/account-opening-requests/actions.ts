"use server";

import { revalidatePath } from "next/cache";
import { getVillagePermissionContext } from "@/lib/admin-permission.server";
import {
  approveAndActivateHouseAccount,
  HouseAccountOpeningReviewError,
  rejectHouseAccountOpeningRequest,
} from "@/lib/house-account-opening-review-service";
import { revalidateAdminSidebar } from "@/lib/revalidate-admin-sidebar";

export type OpeningReviewActionResult = {
  success: boolean;
  message: string;
};

function refreshOpeningRequestViews(requestId: string) {
  revalidatePath("/admin/population");
  revalidatePath("/admin/population/account-opening-requests");
  revalidatePath(`/admin/population/account-opening-requests/${requestId}`);
  revalidateAdminSidebar();
}

export async function approveOpeningRequestAction(requestId: string): Promise<OpeningReviewActionResult> {
  const context = await getVillagePermissionContext("binding.review");
  if (!context) return { success: false, message: "คุณไม่มีสิทธิ์อนุมัติคำขอนี้" };
  try {
    const result = await approveAndActivateHouseAccount(context.session.id, requestId);
    refreshOpeningRequestViews(requestId);
    if (result.outcome === "ALREADY_APPROVED") {
      return { success: true, message: "คำขอนี้ได้รับการอนุมัติและเปิดบัญชีแล้ว" };
    }
    return {
      success: true,
      message: result.emailDelivered
        ? "อนุมัติและเปิดบัญชีบ้านเรียบร้อยแล้ว"
        : "เปิดบัญชีบ้านเรียบร้อยแล้ว แต่ไม่สามารถส่งอีเมลแจ้งผลได้",
    };
  } catch (error) {
    if (error instanceof HouseAccountOpeningReviewError) return { success: false, message: error.message };
    console.error("[house-account-opening] approval failed", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return { success: false, message: "ไม่สามารถเปิดบัญชีบ้านได้ กรุณาลองใหม่อีกครั้ง" };
  }
}

export async function rejectOpeningRequestAction(requestId: string, reason: string): Promise<OpeningReviewActionResult> {
  const context = await getVillagePermissionContext("binding.review");
  if (!context) return { success: false, message: "คุณไม่มีสิทธิ์ปฏิเสธคำขอนี้" };
  try {
    const result = await rejectHouseAccountOpeningRequest(context.session.id, requestId, reason);
    refreshOpeningRequestViews(requestId);
    if (result.outcome === "ALREADY_REJECTED") {
      return { success: true, message: "คำขอนี้ถูกปฏิเสธแล้ว" };
    }
    return {
      success: true,
      message: result.emailDelivered
        ? "ปฏิเสธคำขอและส่งอีเมลแจ้งผลแล้ว"
        : "ปฏิเสธคำขอแล้ว แต่ไม่สามารถส่งอีเมลแจ้งผลได้",
    };
  } catch (error) {
    if (error instanceof HouseAccountOpeningReviewError) return { success: false, message: error.message };
    console.error("[house-account-opening] rejection failed", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return { success: false, message: "ไม่สามารถปฏิเสธคำขอได้ กรุณาลองใหม่อีกครั้ง" };
  }
}
