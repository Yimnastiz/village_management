"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { APPOINTMENT_STAGE_LABELS } from "@/lib/constants";
import { formatThaiDate } from "@/lib/utils";
import {
  approveAppointmentAction,
  rejectAppointmentAction,
  suggestTimeAction,
  adminCancelAppointmentAction,
  adminEditAppointmentAction,
} from "../../../../(resident)/resident/appointments/actions";
import { ArrowLeft, AlertCircle, CheckCircle, Pencil, X } from "lucide-react";
import Link from "next/link";
import type { Appointment, AppointmentSlot, User } from "@prisma/client";

interface AppointmentDetail extends Appointment {
  user: Pick<User, "email" | "name">;
  slot: AppointmentSlot | null;
  timeline: any[];
}

interface AdminAppointmentDetailPageProps {
  params: Promise<{ appointmentId: string }>;
}

const stageVariant: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  PENDING_APPROVAL: "warning",
  TIME_SUGGESTED: "info",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "default",
  COMPLETED: "info",
};

export default function AdminAppointmentDetailPage(props: AdminAppointmentDetailPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [appointment, setAppointment] = useState<AppointmentDetail | null>(null);
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSlotId, setEditSlotId] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const requestedAction = searchParams.get("action");
  const [reviewNote, setReviewNote] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");

  useEffect(() => {
    const getParams = async () => {
      const p = await props.params;
      setAppointmentId(p.appointmentId);
    };
    getParams();
  }, [props.params]);

  useEffect(() => {
    if (!appointmentId) return;

    const fetchAppointmentAndSlots = async () => {
      try {
        const aptResponse = await fetch(`/api/appointments/${appointmentId}`);

        if (!aptResponse.ok) throw new Error("Failed to fetch appointment");

        const apt = await aptResponse.json();
        const slotsResponse = await fetch(
          `/api/appointments/available-slots?villageId=${apt.villageId}`
        );
        if (!slotsResponse.ok) throw new Error("Failed to fetch slots");
        const slotsData = await slotsResponse.json();

        setAppointment(apt);
        setSlots(slotsData);
        if (apt.slotId) {
          setSelectedSlotId(apt.slotId);
        }
        // Initialise edit form fields
        setEditTitle(apt.title ?? "");
        setEditDescription(apt.description ?? "");
        setEditSlotId(apt.slotId ?? "");
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("ไม่สามารถโหลดข้อมูลนัดหมายได้");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAppointmentAndSlots();
  }, [appointmentId]);

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointmentId) return;

    setIsSubmitting(true);
    setError(null);
    const formData = new FormData();
    formData.append("appointmentId", appointmentId);
    if (selectedSlotId) formData.append("slotId", selectedSlotId);
    formData.append("reviewNote", reviewNote);
    const result = await approveAppointmentAction(formData);
    if (!result.success) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }
    setSuccessMessage("อนุมัตินัดหมายเรียบร้อยแล้ว");
    setTimeout(() => router.push("/admin/appointments?success=1"), 500);
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointmentId) return;

    setIsSubmitting(true);
    setError(null);
    const formData = new FormData();
    formData.append("appointmentId", appointmentId);
    formData.append("reviewNote", reviewNote);
    const result = await rejectAppointmentAction(formData);
    if (!result.success) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }
    setSuccessMessage("ปฏิเสธนัดหมายเรียบร้อยแล้ว");
    setTimeout(() => router.push("/admin/appointments?success=1"), 500);
  };

  const handleSuggestTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointmentId) return;
    if (!selectedSlotId) {
      setError("กรุณาเลือกช่วงเวลาก่อนแนะนำเวลา");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const formData = new FormData();
    formData.append("appointmentId", appointmentId);
    formData.append("slotId", selectedSlotId);
    formData.append("message", reviewNote);
    const result = await suggestTimeAction(formData);
    if (!result.success) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }
    setSuccessMessage("แนะนำเวลาใหม่เรียบร้อยแล้ว รอลูกบ้านยืนยัน");
    setTimeout(() => router.push("/admin/appointments?success=1"), 500);
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointmentId) return;
    setIsSubmitting(true);
    setError(null);
    const formData = new FormData();
    formData.append("appointmentId", appointmentId);
    formData.append("reason", cancelReason);
    const result = await adminCancelAppointmentAction(formData);
    if (!result.success) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }
    setSuccessMessage("ยกเลิกนัดหมายเรียบร้อยแล้ว");
    setTimeout(() => router.push("/admin/appointments?success=1"), 500);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointmentId) return;
    setIsSubmitting(true);
    setError(null);
    const formData = new FormData();
    formData.append("appointmentId", appointmentId);
    formData.append("title", editTitle);
    formData.append("description", editDescription);
    if (editSlotId) formData.append("slotId", editSlotId);
    const result = await adminEditAppointmentAction(formData);
    if (!result.success) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }
    setSuccessMessage("แก้ไขนัดหมายเรียบร้อยแล้ว");
    setShowEditForm(false);
    // Refresh appointment data
    setIsLoading(true);
    const aptResponse = await fetch(`/api/appointments/${appointmentId}`);
    if (aptResponse.ok) {
      const apt = await aptResponse.json();
      setAppointment(apt);
    }
    setIsLoading(false);
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">กำลังโหลด...</p>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="space-y-6">
        <Link href="/admin/appointments" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const slotOptions = [
    { value: "", label: "— ไม่เปลี่ยนเวลา —" },
    ...slots
      .filter((slot) => !slot.isBlocked)
      .map((slot) => ({
        value: slot.id,
        label: `${formatThaiDate(slot.date)} - ${slot.startTime} ถึง ${slot.endTime}`,
      })),
  ];

  const allSlotOptions = slots
    .filter((slot) => !slot.isBlocked)
    .map((slot) => ({
      value: slot.id,
      label: `${formatThaiDate(slot.date)} - ${slot.startTime} ถึง ${slot.endTime}`,
    }));

  const mode: "approve" | "reject" | "suggest" | "waiting_confirm" | "view_only" =
    requestedAction === "reject"
      ? "reject"
      : requestedAction === "suggest" && appointment.stage === "PENDING_APPROVAL"
        ? "suggest"
      : appointment.stage === "TIME_SUGGESTED"
        ? "waiting_confirm"
        : appointment.stage !== "PENDING_APPROVAL"
          ? "view_only"
          : appointment.slotId
            ? "approve"
            : "suggest";

  const canEdit = ["PENDING_APPROVAL", "TIME_SUGGESTED", "APPROVED"].includes(appointment.stage);
  const canCancel = ["PENDING_APPROVAL", "TIME_SUGGESTED", "APPROVED"].includes(appointment.stage);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/appointments" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">รายละเอียดนัดหมาย</h1>
        </div>
        {/* Edit / Cancel quick-access buttons */}
        <div className="flex gap-2">
          {canEdit && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => { setShowEditForm((v) => !v); setShowCancelForm(false); }}
            >
              <Pencil className="h-4 w-4 mr-1" /> แก้ไข
            </Button>
          )}
          {canCancel && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setShowCancelForm((v) => !v); setShowEditForm(false); }}
            >
              <X className="h-4 w-4 mr-1" /> ยกเลิกนัด
            </Button>
          )}
        </div>
      </div>

      {successMessage && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
          <CheckCircle className="h-5 w-5" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Appointment Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{appointment.title}</h2>
            <p className="text-sm text-gray-600 mt-1">{appointment.description}</p>
          </div>
          <Badge variant={stageVariant[appointment.stage] ?? "default"}>
            {APPOINTMENT_STAGE_LABELS[appointment.stage]}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
          <div>
            <p className="text-xs text-gray-400">ผู้ขอนัด</p>
            <p className="font-medium">{appointment.user?.name || appointment.user?.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">สร้างเมื่อ</p>
            <p className="font-medium">{formatThaiDate(appointment.createdAt)}</p>
          </div>
          {(appointment.slot || appointment.scheduledAt) && (
            <>
              <div>
                <p className="text-xs text-gray-400">
                  {appointment.slot ? "วันที่นัด" : "วันที่ที่ลูกบ้านต้องการ"}
                </p>
                <p className="font-medium">{formatThaiDate(appointment.slot?.date ?? appointment.scheduledAt!)}</p>
              </div>
              {appointment.slot && (
                <div>
                  <p className="text-xs text-gray-400">เวลา</p>
                  <p className="font-medium">{appointment.slot.startTime} - {appointment.slot.endTime}</p>
                </div>
              )}
            </>
          )}
          {appointment.reviewNote && (
            <div className="col-span-2">
              <p className="text-xs text-gray-400">หมายเหตุ</p>
              <p className="font-medium">{appointment.reviewNote}</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Form */}
      {showEditForm && canEdit && (
        <div className="bg-white rounded-xl border border-blue-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">แก้ไขนัดหมาย</h3>
          <form onSubmit={handleEdit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อนัดหมาย</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                required
                minLength={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด (ไม่บังคับ)</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <Select
              label="เปลี่ยนช่วงเวลา (ไม่บังคับ)"
              value={editSlotId}
              onChange={(e) => setEditSlotId(e.target.value)}
              options={slotOptions}
            />
            <div className="flex gap-2">
              <Button type="submit" isLoading={isSubmitting} className="flex-1">
                บันทึก
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowEditForm(false)} className="flex-1">
                ยกเลิก
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Cancel Form */}
      {showCancelForm && canCancel && (
        <div className="bg-white rounded-xl border border-red-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">ยกเลิกนัดหมาย</h3>
          <form onSubmit={handleCancel} className="space-y-3">
            <Textarea
              label="เหตุผลการยกเลิก (ไม่บังคับ)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="ระบุเหตุผลที่ยกเลิก"
              rows={3}
            />
            <div className="flex gap-2">
              <Button type="submit" isLoading={isSubmitting} variant="outline" className="flex-1 border-red-300 text-red-700 hover:bg-red-50">
                ยืนยันการยกเลิก
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowCancelForm(false)} className="flex-1">
                กลับ
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Waiting for resident confirmation banner */}
      {mode === "waiting_confirm" && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <p className="font-semibold text-blue-900">รอลูกบ้านยืนยันเวลา</p>
          <p className="text-sm text-blue-700 mt-1">
            คุณแนะนำเวลา {appointment.slot?.startTime}-{appointment.slot?.endTime} น. วันที่{" "}
            {appointment.slot ? formatThaiDate(appointment.slot.date) : "-"} แล้ว
            กำลังรอลูกบ้านยืนยัน
          </p>
        </div>
      )}

      {/* Primary action forms (only when PENDING_APPROVAL) */}
      {appointment.stage === "PENDING_APPROVAL" && mode === "approve" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">อนุมัตินัดหมาย</h3>
          {appointment.slot ? (
            <p className="text-sm text-gray-600">
              ช่วงเวลาที่ลูกบ้านเลือก: {formatThaiDate(appointment.slot.date)} {appointment.slot.startTime} - {appointment.slot.endTime}
            </p>
          ) : (
            appointment.scheduledAt && (
              <p className="text-sm text-gray-600">
                วันที่ที่ลูกบ้านต้องการ: {formatThaiDate(appointment.scheduledAt)} (ยังไม่ได้เลือกช่วงเวลา)
              </p>
            )
          )}
          <form onSubmit={handleApprove} className="space-y-3">
            <Textarea
              label="หมายเหตุ (ไม่บังคับ)"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="ใส่หมายเหตุเพิ่มเติม"
              rows={3}
            />
            <Button type="submit" isLoading={isSubmitting} className="w-full">
              อนุมัติ
            </Button>
          </form>
        </div>
      )}

      {appointment.stage === "PENDING_APPROVAL" && mode === "suggest" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">แนะนำเวลาใหม่</h3>
          {appointment.scheduledAt && (
            <p className="text-sm text-gray-600">
              วันที่ที่ลูกบ้านต้องการ: {formatThaiDate(appointment.scheduledAt)}
            </p>
          )}
          {allSlotOptions.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              ยังไม่มีช่วงเวลาว่างสำหรับการแนะนำ
              <Link href="/admin/appointments/slots" className="ml-1 font-medium underline">
                ไปจัดการช่วงเวลา
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSuggestTime} className="space-y-3">
              <Select
                label="เลือกเวลาแนะนำ"
                value={selectedSlotId}
                onChange={(e) => setSelectedSlotId(e.target.value)}
                options={allSlotOptions}
                required
              />
              <Textarea
                label="ข้อความถึงลูกบ้าน"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="เช่น วันที่นี้ผู้ใหญ่ไม่สะดวก ขอเป็นช่วงเวลานี้แทน"
                rows={3}
              />
              <Button type="submit" isLoading={isSubmitting} className="w-full">
                แนะนำเวลา (แจ้งเตือนลูกบ้าน)
              </Button>
            </form>
          )}
        </div>
      )}

      {appointment.stage === "PENDING_APPROVAL" && mode === "reject" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">ปฏิเสธคำขอนัดหมาย</h3>
          <form onSubmit={handleReject} className="space-y-3">
            <Textarea
              label="เหตุผลการปฏิเสธ"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร"
              rows={4}
            />
            <Button type="submit" isLoading={isSubmitting} variant="outline" className="w-full">
              ปฏิเสธ
            </Button>
          </form>
        </div>
      )}

      {/* Timeline */}
      {appointment.timeline && appointment.timeline.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">ประวัติ</h2>
          <div className="space-y-3">
            {appointment.timeline.map((entry: any, idx: number) => (
              <div key={entry.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  {idx < appointment.timeline.length - 1 && (
                    <div className="w-0.5 h-12 bg-gray-200 my-1"></div>
                  )}
                </div>
                <div className="flex-1 pb-2">
                  <p className="font-medium text-sm text-gray-900">{entry.action}</p>
                  {entry.description && (
                    <p className="text-xs text-gray-600 mt-1">{entry.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{formatThaiDate(entry.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
