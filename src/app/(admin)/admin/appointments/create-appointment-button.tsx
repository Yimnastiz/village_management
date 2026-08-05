"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateAppointmentForm } from "./create-appointment-form";
export function CreateAppointmentButton() { const [open, setOpen] = useState(false); return <><Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> สร้างนัดหมาย</Button>{open ? <div className="fixed inset-0 z-[90] flex items-end bg-black/40 sm:items-center sm:justify-center"><div className="max-h-[92vh] w-full overflow-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-xl sm:rounded-2xl"><h2 className="mb-4 text-lg font-semibold">สร้างนัดหมายให้ลูกบ้าน</h2><CreateAppointmentForm onClose={() => setOpen(false)} /></div></div> : null}</>; }
