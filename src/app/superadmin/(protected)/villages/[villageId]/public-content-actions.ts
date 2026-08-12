"use server";

import { redirect } from "next/navigation";
import { requireSuperAdminVillageContext, requireSupportReason } from "@/features/village-public-content/server/context";
import {
  createContact,
  createEvent,
  createNews,
  createPlace,
  createTransparency,
  deleteContact,
  deleteEvent,
  deleteNews,
  deletePlace,
  deleteTransparency,
  updateContact,
  updateEvent,
  updateNews,
  updatePlace,
  updateTransparency,
} from "@/features/village-public-content/server/service";
import { prisma } from "@/lib/prisma";

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

function boolValue(formData: FormData, key: string) {
  return formData.get(key) === "on" || value(formData, key) === "true" || value(formData, key) === "PUBLIC";
}

function redirectWithSuccess(villageId: string, module: string, message: string): never {
  redirect(`/superadmin/villages/${villageId}/${module}?success=${encodeURIComponent(message)}`);
}

async function superContext(villageId: string, formData: FormData) {
  const context = await requireSuperAdminVillageContext(villageId);
  return { ...context, supportReason: requireSupportReason(value(formData, "supportReason")) };
}

export async function superAdminSaveNewsAction(villageId: string, formData: FormData) {
  const context = await superContext(villageId, formData);
  const newsId = value(formData, "resourceId");
  const payload = {
    title: value(formData, "title"),
    summary: value(formData, "summary"),
    content: value(formData, "content"),
    imageUrls: value(formData, "imageUrls").split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean),
    coverUrl: value(formData, "coverUrl") || null,
    visibility: value(formData, "visibility") || "PUBLIC",
    stage: value(formData, "stage") || "DRAFT",
    isPinned: boolValue(formData, "isPinned"),
  };
  const result = newsId ? await updateNews(context, newsId, payload) : await createNews(context, payload);
  if (!result.success) throw new Error(result.error);
  redirectWithSuccess(villageId, "news", newsId ? "บันทึกการแก้ไขข่าวเรียบร้อยแล้ว" : "สร้างข่าวเรียบร้อยแล้ว");
}

export async function superAdminSetNewsStageAction(villageId: string, formData: FormData) {
  const context = await superContext(villageId, formData);
  const newsId = value(formData, "resourceId");
  const targetStage = value(formData, "stage") || "DRAFT";
  const existing = await prisma.news.findFirst({ where: { id: newsId, villageId }, select: { title: true, summary: true, content: true, imageUrls: true, coverUrl: true, visibility: true, isPinned: true } });
  if (!existing) throw new Error("ไม่พบข่าวในหมู่บ้านเป้าหมาย");
  const result = await updateNews(context, newsId, {
    title: existing.title,
    summary: existing.summary ?? "",
    content: existing.content,
    imageUrls: Array.isArray(existing.imageUrls) ? existing.imageUrls.map(String) : [],
    coverUrl: existing.coverUrl,
    visibility: existing.visibility,
    stage: targetStage,
    isPinned: existing.isPinned,
  });
  if (!result.success) throw new Error(result.error);
  redirectWithSuccess(villageId, "news", "เปลี่ยนสถานะข่าวเรียบร้อยแล้ว");
}

export async function superAdminDeleteNewsAction(villageId: string, formData: FormData) {
  const context = await superContext(villageId, formData);
  const result = await deleteNews(context, value(formData, "resourceId"));
  if (!result.success) throw new Error(result.error);
  redirectWithSuccess(villageId, "news", "ลบข่าวเรียบร้อยแล้ว");
}

export async function superAdminSaveContactAction(villageId: string, formData: FormData) {
  const context = await superContext(villageId, formData);
  const id = value(formData, "resourceId");
  const payload = {
    name: value(formData, "name"),
    role: value(formData, "role"),
    phone: value(formData, "phone"),
    email: value(formData, "email"),
    address: value(formData, "address"),
    category: value(formData, "category"),
    sortOrder: value(formData, "sortOrder") || "0",
    isPublic: boolValue(formData, "isPublic") ? "PUBLIC" : "RESIDENT",
  };
  const result = id ? await updateContact(context, id, payload) : await createContact(context, payload);
  if (!result.success) throw new Error(result.error);
  redirectWithSuccess(villageId, "contacts", id ? "บันทึกผู้ติดต่อเรียบร้อยแล้ว" : "เพิ่มผู้ติดต่อเรียบร้อยแล้ว");
}

export async function superAdminDeleteContactAction(villageId: string, formData: FormData) {
  const context = await superContext(villageId, formData);
  const result = await deleteContact(context, value(formData, "resourceId"));
  if (!result.success) throw new Error(result.error);
  redirectWithSuccess(villageId, "contacts", "ลบผู้ติดต่อเรียบร้อยแล้ว");
}

export async function superAdminSavePlaceAction(villageId: string, formData: FormData) {
  const context = await superContext(villageId, formData);
  const id = value(formData, "resourceId");
  const payload = {
    name: value(formData, "name"),
    category: value(formData, "category") || "OTHER",
    description: value(formData, "description"),
    address: value(formData, "address"),
    openingHours: value(formData, "openingHours"),
    contactPhone: value(formData, "contactPhone"),
    mapUrl: value(formData, "mapUrl"),
    latitude: value(formData, "latitude"),
    longitude: value(formData, "longitude"),
    isPublic: boolValue(formData, "isPublic"),
    imageUrls: value(formData, "imageUrls").split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean),
  };
  const result = id ? await updatePlace(context, id, payload) : await createPlace(context, payload);
  if (!result.success) throw new Error(result.error);
  redirectWithSuccess(villageId, "places", id ? "บันทึกสถานที่เรียบร้อยแล้ว" : "เพิ่มสถานที่เรียบร้อยแล้ว");
}

export async function superAdminDeletePlaceAction(villageId: string, formData: FormData) {
  const context = await superContext(villageId, formData);
  const result = await deletePlace(context, value(formData, "resourceId"));
  if (!result.success) throw new Error(result.error);
  redirectWithSuccess(villageId, "places", "ลบสถานที่เรียบร้อยแล้ว");
}

export async function superAdminSaveEventAction(villageId: string, formData: FormData) {
  const context = await superContext(villageId, formData);
  const id = value(formData, "resourceId");
  const payload = {
    title: value(formData, "title"),
    description: value(formData, "description"),
    location: value(formData, "location"),
    startsAt: value(formData, "startsAt"),
    endsAt: value(formData, "endsAt"),
    isPublic: boolValue(formData, "isPublic") ? "PUBLIC" : "RESIDENT",
  };
  const result = id ? await updateEvent(context, id, payload) : await createEvent(context, payload);
  if (!result.success) throw new Error(result.error);
  redirectWithSuccess(villageId, "calendar", id ? "บันทึกกิจกรรมเรียบร้อยแล้ว" : "เพิ่มกิจกรรมเรียบร้อยแล้ว");
}

export async function superAdminDeleteEventAction(villageId: string, formData: FormData) {
  const context = await superContext(villageId, formData);
  const result = await deleteEvent(context, value(formData, "resourceId"));
  if (!result.success) throw new Error(result.error);
  redirectWithSuccess(villageId, "calendar", "ลบกิจกรรมเรียบร้อยแล้ว");
}

export async function superAdminSaveTransparencyAction(villageId: string, formData: FormData) {
  const context = await superContext(villageId, formData);
  const id = value(formData, "resourceId");
  const amountRaw = value(formData, "amount");
  const amount = amountRaw ? Number(amountRaw) : undefined;
  if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) throw new Error("จำนวนเงินไม่ถูกต้อง");
  const payload = {
    title: value(formData, "title"),
    description: value(formData, "description"),
    category: value(formData, "category"),
    amount,
    fiscalYear: value(formData, "fiscalYear"),
    stage: value(formData, "stage") || "DRAFT",
    visibility: value(formData, "visibility") || "PUBLIC",
  };
  const result = id ? await updateTransparency(context, id, payload) : await createTransparency(context, payload);
  if (!result.success) throw new Error(result.error);
  redirectWithSuccess(villageId, "transparency", id ? "บันทึกรายการเรียบร้อยแล้ว" : "เพิ่มรายการเรียบร้อยแล้ว");
}

export async function superAdminDeleteTransparencyAction(villageId: string, formData: FormData) {
  const context = await superContext(villageId, formData);
  const result = await deleteTransparency(context, value(formData, "resourceId"));
  if (!result.success) throw new Error(result.error);
  redirectWithSuccess(villageId, "transparency", "ลบรายการเรียบร้อยแล้ว");
}
