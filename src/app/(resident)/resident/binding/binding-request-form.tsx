"use client";

import { CheckCircle2, Search } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { normalizeHouseNumber } from "@/lib/house-number";
import { submitBindingRequestAction, type BindingRequestActionState } from "./actions";

type HouseOption = {
  id: string;
  houseNumber: string;
  normalizedHouseNumber: string;
};

type LatestRequest = {
  houseId: string | null;
  houseNumber: string | null;
  note: string | null;
} | null;

export function BindingRequestForm({
  village,
  houses,
  latestRequest,
  hasPending,
  isRejected,
  signedIn,
}: {
  village: { id: string; name: string; moo: string | null; province: string | null; district: string | null; subdistrict: string | null };
  houses: HouseOption[];
  latestRequest: LatestRequest;
  hasPending: boolean;
  isRejected: boolean;
  signedIn: boolean;
}) {
  const [actionState, formAction, isPending] = useActionState<BindingRequestActionState, FormData>(submitBindingRequestAction, { success: false });
  const initialHouse = houses.find((house) => house.id === latestRequest?.houseId) ?? null;
  const [mode, setMode] = useState<"existing" | "suggest">(
    initialHouse || !latestRequest?.houseNumber ? "existing" : "suggest"
  );
  const [houseQuery, setHouseQuery] = useState(initialHouse?.houseNumber ?? "");
  const [selectedHouseId, setSelectedHouseId] = useState(initialHouse?.id ?? "");
  const [houseSearchSubmitted, setHouseSearchSubmitted] = useState(Boolean(initialHouse));

  const selectedHouse = houses.find((house) => house.id === selectedHouseId) ?? null;
  const normalizedHouseQuery = normalizeHouseNumber(houseQuery);
  const filteredHouses = useMemo(() => {
    if (!houseSearchSubmitted || !normalizedHouseQuery) return [];
    return houses
      .filter(
        (house) =>
          house.normalizedHouseNumber.includes(normalizedHouseQuery) ||
          normalizeHouseNumber(house.houseNumber).includes(normalizedHouseQuery)
      )
      .slice(0, 50);
  }, [houses, houseSearchSubmitted, normalizedHouseQuery]);
  const hasHouseSearchQuery = houseQuery.trim().length > 0;
  const shouldShowNoHouseResult = houseSearchSubmitted && hasHouseSearchQuery && filteredHouses.length === 0;

  const switchToSuggest = () => {
    setMode("suggest");
    setSelectedHouseId("");
  };

  const canSubmit = mode === "existing" ? Boolean(selectedHouseId) : Boolean(houseQuery.trim());

  return (
    <form action={formAction} className="space-y-6">
      <section className="rounded-xl border border-green-100 bg-green-50/60 p-4">
        <h2 className="text-sm font-semibold text-gray-900">Configured Village</h2>
        <p className="mt-1 break-words font-medium text-gray-800">{village.name}{village.moo ? ` Moo ${village.moo}` : ""}</p>
        <p className="mt-1 text-xs text-gray-600">{[village.subdistrict, village.district, village.province].filter(Boolean).join(" · ")}</p>
      </section>

      {mode === "existing" ? (
          <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs font-semibold text-green-800">2</span>
              <h2 className="text-sm font-semibold text-gray-900">เลือกบ้านเลขที่</h2>
            </div>
            <div>
            <label htmlFor="house-search" className="mb-1 block text-sm text-gray-600">ค้นหาเลขบ้านในทะเบียน</label>
            <input type="hidden" name="requestedHouseId" value={selectedHouseId} />
            <div className="flex gap-2">
              <input
                id="house-search"
                value={houseQuery}
                disabled={hasPending}
                autoComplete="off"
                placeholder="เช่น 777 หรือ 96/4"
                onChange={(event) => {
                  setHouseQuery(event.target.value);
                  setSelectedHouseId("");
                  setHouseSearchSubmitted(false);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  setHouseSearchSubmitted(true);
                }}
                className="block min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100 disabled:bg-gray-100"
              />
              <button type="button" onClick={() => setHouseSearchSubmitted(true)} disabled={!houseQuery.trim() || hasPending} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
                <Search className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">ค้นหา</span>
              </button>
            </div>
          </div>

          {selectedHouse ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
                <div>
                  <p className="font-semibold">บ้านที่เลือก</p>
                  <p>คุณกำลังขอผูกกับบ้านเลขที่ {selectedHouse.houseNumber}</p>
                </div>
              </div>
              {!hasPending ? (
                <button type="button" onClick={() => { setSelectedHouseId(""); setHouseQuery(""); }} className="mt-2 text-xs font-medium text-green-700 hover:underline">
                  เปลี่ยนเลขบ้าน
                </button>
              ) : null}
            </div>
          ) : (
            hasHouseSearchQuery && filteredHouses.length ? <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white">
              {filteredHouses.map((house) => (
                <button
                  key={house.id}
                  type="button"
                  disabled={hasPending}
                  className="block w-full border-b border-gray-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-green-50 disabled:bg-gray-50"
                  onClick={() => {
                    setSelectedHouseId(house.id);
                    setHouseQuery(house.houseNumber);
                  }}
                >
                  บ้านเลขที่ {house.houseNumber}
                </button>
              ))}
            </div> : shouldShowNoHouseResult ? <div className="rounded-lg border border-gray-200 bg-white px-3 py-4 text-sm text-gray-500">ไม่พบบ้านเลขที่นี้ในทะเบียนบ้านของหมู่บ้าน</div> : <p className="text-xs text-gray-500">พิมพ์บ้านเลขที่เพื่อค้นหา</p>
          )}

          {!hasPending ? (
            <button type="button" onClick={switchToSuggest} className="text-sm font-medium text-amber-700 hover:underline">
              ไม่พบเลขบ้านของฉัน
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <input type="hidden" name="requestedHouseId" value="" />
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-200 text-xs font-semibold text-amber-900">2</span>
            <h2 className="text-sm font-semibold text-amber-950">แจ้งเลขบ้านให้ตรวจสอบ</h2>
          </div>
          <div>
            <label htmlFor="houseNumber" className="mb-1 block text-sm font-medium text-amber-950">เลขบ้านที่ต้องการให้ผู้ดูแลตรวจสอบ</label>
            <input
              id="houseNumber"
              name="houseNumber"
              required
              disabled={hasPending}
              value={houseQuery}
              onChange={(event) => setHouseQuery(event.target.value)}
              placeholder="เช่น 96/4"
              className="block w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:bg-gray-100"
            />
            <p className="mt-1 text-xs text-amber-800">ข้อมูลนี้เป็นคำขอให้ผู้ดูแลตรวจสอบ ยังไม่ใช่บ้านจริงในระบบ</p>
          </div>
          {!hasPending ? (
            <button type="button" onClick={() => setMode("existing")} className="text-sm font-medium text-amber-800 hover:underline">
              กลับไปเลือกบ้านจากทะเบียน
            </button>
          ) : null}
        </div>
      )}

      <div>
        <label htmlFor="note" className="mb-1 block text-sm font-semibold text-gray-900">หมายเหตุ <span className="font-normal text-gray-500">(ไม่บังคับ)</span></label>
        <textarea
          id="note"
          name="note"
          defaultValue={latestRequest?.note ?? ""}
          rows={3}
          placeholder="รายละเอียดเพิ่มเติมสำหรับการพิจารณา"
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
        />
      </div>

      {actionState.fieldErrors?.house ? <p role="alert" className="text-sm text-red-700">{actionState.fieldErrors.house}</p> : null}
      {actionState.message ? <p role="alert" className="text-sm text-red-700">{actionState.message}</p> : null}

      <button type="submit" disabled={!canSubmit || isPending || hasPending} className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
        {hasPending ? "อัปเดตคำขอผูกบ้านเดิม" : isRejected ? "แก้ไขคำขอและส่งใหม่" : "ส่งคำขอผูกบ้าน"}
      </button>

      {!signedIn ? (
        <p className="mt-2 text-sm text-gray-600">
          คุณต้องเข้าสู่ระบบเพื่อส่งคำขอผูกบ้าน
        </p>
      ) : null}
    </form>
  );
}
