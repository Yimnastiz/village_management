"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { reorderContactsAction } from "./actions";

export type AdminContactListItem = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  category: string | null;
  isPublic: boolean;
};

function ContactCard({ contact, sortable, disabled }: { contact: AdminContactListItem; sortable: boolean; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: contact.id, disabled: !sortable || disabled });
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`relative min-w-0 rounded-xl border bg-white p-4 transition-shadow ${isDragging ? "z-10 border-green-500 opacity-80 shadow-sm" : "border-gray-200 hover:shadow-md"}`}>
    {sortable ? <button type="button" {...attributes} {...listeners} onClick={(event) => event.stopPropagation()} aria-label={`จัดลำดับ ${contact.name}`} disabled={disabled} className="absolute right-2 top-2 z-10 flex h-11 w-11 touch-none items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-40"><GripVertical className="h-5 w-5" aria-hidden="true" /></button> : null}
    <Link href={`/admin/contacts/${contact.id}`} className="block min-w-0 pr-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge variant={contact.isPublic ? "success" : "info"}>{contact.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}</Badge>
            {contact.category ? <Badge variant="outline">{contact.category}</Badge> : null}
          </div>
          <p className="font-semibold text-gray-900">{contact.name}</p>
          <p className="mt-1 text-sm text-gray-500">{contact.role || "ไม่ระบุตำแหน่ง"}</p>
          {contact.phone ? <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-green-700"><Phone className="h-4 w-4" aria-hidden="true" />{contact.phone}</p> : null}
        </div>
      </div>
    </Link>
  </article>;
}

export function ContactSortableList({ contacts, enabled }: { contacts: AdminContactListItem[]; enabled: boolean }) {
  const toast = useToast();
  const [items, setItems] = useState(contacts);
  const itemsRef = useRef(items);
  const [saving, setSaving] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => { itemsRef.current = contacts; setItems(contacts); }, [contacts]);

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!enabled || saving || !over || active.id === over.id) return;
    const from = itemsRef.current.findIndex((item) => item.id === active.id);
    const to = itemsRef.current.findIndex((item) => item.id === over.id);
    if (from < 0 || to < 0) return;

    const previous = itemsRef.current;
    const next = arrayMove(previous, from, to);
    itemsRef.current = next;
    setItems(next);
    setSaving(true);
    const result = await reorderContactsAction(next.map((item) => item.id));
    setSaving(false);
    if (result.success) {
      toast.success("บันทึกลำดับผู้ติดต่อแล้ว");
      return;
    }
    itemsRef.current = previous;
    setItems(previous);
    toast.error("บันทึกลำดับไม่สำเร็จ");
  };

  const cards = <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">{items.map((contact) => <ContactCard key={contact.id} contact={contact} sortable={enabled} disabled={saving} />)}</div>;
  if (!enabled) return cards;
  return <DndContext
    sensors={sensors}
    collisionDetection={closestCenter}
    onDragEnd={onDragEnd}
    accessibility={{
      announcements: {
        onDragStart: ({ active }) => `เริ่มจัดลำดับ ${itemsRef.current.find((item) => item.id === active.id)?.name ?? "ผู้ติดต่อ"}`,
        onDragOver: ({ over }) => over ? `กำลังวางที่ ${itemsRef.current.find((item) => item.id === over.id)?.name ?? "ตำแหน่งใหม่"}` : "",
        onDragEnd: ({ active, over }) => over ? `จัดลำดับ ${itemsRef.current.find((item) => item.id === active.id)?.name ?? "ผู้ติดต่อ"} แล้ว` : "ยกเลิกการจัดลำดับ",
        onDragCancel: () => "ยกเลิกการจัดลำดับ",
      },
    }}
  ><SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}>{cards}</SortableContext></DndContext>;
}
