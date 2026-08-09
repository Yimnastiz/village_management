"use client";

import { CheckCircle2, ChevronDown, Search } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { normalizeHouseNumber } from "@/lib/house-number";
import { formatVillageLabel, formatVillageLocation, villageSearchText } from "@/lib/village-label";
import { submitBindingRequestAction, type BindingRequestActionState } from "./actions";

type VillageOption = {
  id: string;
  name: string;
  moo: string | null;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
};

type HouseOption = {
  id: string;
  villageId: string;
  houseNumber: string;
  normalizedHouseNumber: string;
};

type LatestRequest = {
  villageId: string | null;
  houseId: string | null;
  houseNumber: string | null;
  note: string | null;
} | null;

function villageLabel(village: VillageOption) {
  const location = formatVillageLocation(village);
  const label = formatVillageLabel(village.name, village.moo);
  return location ? `${label} (${location})` : label;
}

export function BindingRequestForm({
  villages,
  houses,
  latestRequest,
  hasPending,
  isRejected,
  signedIn,
}: {
  villages: VillageOption[];
  houses: HouseOption[];
  latestRequest: LatestRequest;
  hasPending: boolean;
  isRejected: boolean;
  signedIn: boolean;
}) {
  const [actionState, formAction, isPending] = useActionState<BindingRequestActionState, FormData>(submitBindingRequestAction, { success: false });
  const initialVillage = villages.find((village) => village.id === latestRequest?.villageId) ?? villages[0] ?? null;
  const initialHouse = houses.find((house) => house.id === latestRequest?.houseId) ?? null;
  const [selectedVillageId, setSelectedVillageId] = useState(initialVillage?.id ?? "");
  const [villageQuery, setVillageQuery] = useState(initialVillage ? villageLabel(initialVillage) : "");
  const [villageOpen, setVillageOpen] = useState(false);
  const villageRootRef = useRef<HTMLDivElement | null>(null);
  const villageOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeVillageIndex, setActiveVillageIndex] = useState(-1);
  const [mode, setMode] = useState<"existing" | "suggest">(
    initialHouse || !latestRequest?.houseNumber ? "existing" : "suggest"
  );
  const [houseQuery, setHouseQuery] = useState(initialHouse?.houseNumber ?? "");
  const [selectedHouseId, setSelectedHouseId] = useState(initialHouse?.id ?? "");
  const [houseSearchSubmitted, setHouseSearchSubmitted] = useState(Boolean(initialHouse));

  const selectedHouse = houses.find((house) => house.id === selectedHouseId) ?? null;
  const normalizedHouseQuery = normalizeHouseNumber(houseQuery);
  const filteredVillages = useMemo(() => {
    const keyword = villageQuery.trim().toLocaleLowerCase("th");
    if (!keyword || selectedVillageId) return villages.slice(0, 50);
    return villages.filter((village) => villageSearchText(village).toLocaleLowerCase("th").includes(keyword)).slice(0, 50);
  }, [selectedVillageId, villageQuery, villages]);
  const filteredHouses = useMemo(() => {
    const villageHouses = houses.filter((house) => house.villageId === selectedVillageId);
    if (!houseSearchSubmitted || !normalizedHouseQuery) return [];
    return villageHouses
      .filter(
        (house) =>
          house.normalizedHouseNumber.includes(normalizedHouseQuery) ||
          normalizeHouseNumber(house.houseNumber).includes(normalizedHouseQuery)
      )
      .slice(0, 50);
  }, [houses, houseSearchSubmitted, normalizedHouseQuery, selectedVillageId]);
  const hasHouseSearchQuery = houseQuery.trim().length > 0;
  const shouldShowNoHouseResult = houseSearchSubmitted && hasHouseSearchQuery && filteredHouses.length === 0;

  useEffect(() => {
    const closeVillageDropdown = (event: MouseEvent | TouchEvent) => {
      if (event.target instanceof Node && !villageRootRef.current?.contains(event.target)) {
        setVillageOpen(false);
        setActiveVillageIndex(-1);
      }
    };
    document.addEventListener("mousedown", closeVillageDropdown);
    document.addEventListener("touchstart", closeVillageDropdown);
    return () => {
      document.removeEventListener("mousedown", closeVillageDropdown);
      document.removeEventListener("touchstart", closeVillageDropdown);
    };
  }, []);

  useEffect(() => {
    if (activeVillageIndex >= 0) villageOptionRefs.current[activeVillageIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeVillageIndex]);

  const switchToSuggest = () => {
    setMode("suggest");
    setSelectedHouseId("");
  };

  const canSubmit = mode === "existing" ? Boolean(selectedHouseId) : Boolean(houseQuery.trim());

  return (
    <form action={formAction} className="space-y-6">
      <div className="relative" ref={villageRootRef}>
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs font-semibold text-green-800">1</span>
          <label htmlFor="village-search" className="text-sm font-semibold text-gray-900">เลือกหมู่บ้าน</label>
        </div>
        <p className="mb-2 ml-8 text-xs text-gray-500">ค้นหาจากชื่อหมู่บ้าน ตำบล อำเภอ หรือจังหวัด</p>
        <input type="hidden" name="villageId" value={selectedVillageId} />
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            id="village-search"
            value={villageQuery}
            required
            disabled={hasPending}
            autoComplete="off"
            role="combobox"
            aria-expanded={villageOpen}
            aria-controls="binding-village-options"
            placeholder="พิมพ์ชื่อหมู่บ้าน ตำบล อำเภอ หรือจังหวัด"
            onFocus={() => { setVillageOpen(true); setActiveVillageIndex(filteredVillages.length ? 0 : -1); }}
            onChange={(event) => {
              setVillageQuery(event.target.value);
              setSelectedVillageId("");
              setSelectedHouseId("");
                setHouseQuery("");
              setHouseSearchSubmitted(false);
              setVillageOpen(true);
              setActiveVillageIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                if (!villageOpen) { setVillageOpen(true); setActiveVillageIndex(0); return; }
                setActiveVillageIndex((index) => event.key === "ArrowDown"
                  ? (index + 1) % Math.max(filteredVillages.length, 1)
                  : (index <= 0 ? filteredVillages.length - 1 : index - 1));
              } else if (event.key === "Enter" && villageOpen && filteredVillages[activeVillageIndex]) {
                event.preventDefault();
                const village = filteredVillages[activeVillageIndex];
                setSelectedVillageId(village.id); setVillageQuery(villageLabel(village)); setSelectedHouseId(""); setHouseQuery(""); setHouseSearchSubmitted(false); setVillageOpen(false); setActiveVillageIndex(-1); setMode("existing");
              } else if (event.key === "Escape") {
                event.preventDefault(); setVillageOpen(false); setActiveVillageIndex(-1);
              }
            }}
            className="min-h-11 w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-10 text-sm shadow-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100 disabled:bg-gray-100"
          />
          <button type="button" aria-label={villageOpen ? "ซ่อนรายการหมู่บ้าน" : "แสดงรายการหมู่บ้าน"} disabled={hasPending} onMouseDown={(event) => event.preventDefault()} onClick={() => setVillageOpen((open) => !open)} className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 disabled:cursor-not-allowed">
            <ChevronDown className={`h-4 w-4 transition-transform ${villageOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
        {villageOpen && !hasPending ? (
          <div id="binding-village-options" className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white p-1 shadow-xl">
            {filteredVillages.length ? filteredVillages.map((village, index) => (
              <button
                key={village.id}
                type="button"
                 ref={(element) => { villageOptionRefs.current[index] = element; }}
                 className={`block w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm hover:bg-green-50 ${activeVillageIndex === index ? "bg-gray-100" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setSelectedVillageId(village.id);
                  setVillageQuery(villageLabel(village));
                  setSelectedHouseId("");
                   setHouseQuery("");
                   setVillageOpen(false);
                   setActiveVillageIndex(-1);
                   setMode("existing");
                }}
              >
                <span className="block truncate font-medium text-gray-900">{formatVillageLabel(village.name, village.moo)}</span>
                <span className="block truncate text-xs text-gray-500">{formatVillageLocation(village)}</span>
              </button>
            )) : <p className="px-3 py-4 text-center text-sm text-gray-500">ไม่พบหมู่บ้านที่ค้นหา</p>}
          </div>
        ) : null}
      </div>

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
                disabled={!selectedVillageId || hasPending}
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
              <button type="button" onClick={() => setHouseSearchSubmitted(true)} disabled={!selectedVillageId || !houseQuery.trim() || hasPending} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
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
      {actionState.fieldErrors?.village ? <p role="alert" className="text-sm text-red-700">{actionState.fieldErrors.village}</p> : null}
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
