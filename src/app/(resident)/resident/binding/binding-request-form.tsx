"use client";

import { CheckCircle2, ChevronDown, Search } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { normalizeHouseNumber } from "@/lib/house-number";
import { submitBindingRequestAction, type BindingRequestActionState } from "./actions";

type VillageOption = {
  id: string;
  name: string;
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
  const location = [village.subdistrict, village.district, village.province].filter(Boolean).join(" / ");
  return location ? `${village.name} (${location})` : village.name;
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
  const [mode, setMode] = useState<"existing" | "suggest">(
    initialHouse || !latestRequest?.houseNumber ? "existing" : "suggest"
  );
  const [houseQuery, setHouseQuery] = useState(initialHouse?.houseNumber ?? "");
  const [selectedHouseId, setSelectedHouseId] = useState(initialHouse?.id ?? "");

  const selectedHouse = houses.find((house) => house.id === selectedHouseId) ?? null;
  const normalizedHouseQuery = normalizeHouseNumber(houseQuery);
  const filteredVillages = useMemo(() => {
    const keyword = villageQuery.trim().toLocaleLowerCase("th");
    if (!keyword || selectedVillageId) return villages.slice(0, 50);
    return villages.filter((village) => villageLabel(village).toLocaleLowerCase("th").includes(keyword)).slice(0, 50);
  }, [selectedVillageId, villageQuery, villages]);
  const filteredHouses = useMemo(() => {
    const villageHouses = houses.filter((house) => house.villageId === selectedVillageId);
    if (!normalizedHouseQuery) return villageHouses.slice(0, 50);
    return villageHouses
      .filter(
        (house) =>
          house.normalizedHouseNumber.includes(normalizedHouseQuery) ||
          normalizeHouseNumber(house.houseNumber).includes(normalizedHouseQuery)
      )
      .slice(0, 50);
  }, [houses, normalizedHouseQuery, selectedVillageId]);

  const switchToSuggest = () => {
    setMode("suggest");
    setSelectedHouseId("");
  };

  const canSubmit = mode === "existing" ? Boolean(selectedHouseId) : Boolean(houseQuery.trim());

  return (
    <form action={formAction} className="space-y-4">
      <div className="relative">
        <label htmlFor="village-search" className="mb-1 block text-sm font-medium text-gray-700">หมู่บ้าน</label>
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
            onFocus={() => setVillageOpen(true)}
            onChange={(event) => {
              setVillageQuery(event.target.value);
              setSelectedVillageId("");
              setSelectedHouseId("");
              setHouseQuery("");
              setVillageOpen(true);
            }}
            className="min-h-11 w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-10 text-sm disabled:bg-gray-100"
          />
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
        {villageOpen && !hasPending ? (
          <div id="binding-village-options" className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white p-1 shadow-xl">
            {filteredVillages.length ? filteredVillages.map((village) => (
              <button
                key={village.id}
                type="button"
                className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-green-50"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setSelectedVillageId(village.id);
                  setVillageQuery(villageLabel(village));
                  setSelectedHouseId("");
                  setHouseQuery("");
                  setVillageOpen(false);
                  setMode("existing");
                }}
              >
                <span className="block font-medium text-gray-900">{village.name}</span>
                <span className="block text-xs text-gray-500">{[village.subdistrict, village.district, village.province].filter(Boolean).join(" / ")}</span>
              </button>
            )) : <p className="px-3 py-4 text-center text-sm text-gray-500">ไม่พบหมู่บ้านที่ค้นหา</p>}
          </div>
        ) : null}
      </div>

      {mode === "existing" ? (
        <div className="space-y-3 rounded-xl border border-gray-200 p-3">
          <div>
            <label htmlFor="house-search" className="mb-1 block text-sm font-medium text-gray-700">ค้นหาเลขบ้าน</label>
            <input type="hidden" name="requestedHouseId" value={selectedHouseId} />
            <input
              id="house-search"
              value={houseQuery}
              disabled={!selectedVillageId || hasPending}
              autoComplete="off"
              placeholder="เช่น 777 หรือ 96/4"
              onChange={(event) => {
                setHouseQuery(event.target.value);
                setSelectedHouseId("");
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                if (filteredHouses.length === 1) {
                  setSelectedHouseId(filteredHouses[0].id);
                  setHouseQuery(filteredHouses[0].houseNumber);
                } else if (houseQuery.trim()) {
                  switchToSuggest();
                }
              }}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
            />
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
            <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white">
              {filteredHouses.length ? filteredHouses.map((house) => (
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
              )) : (
                <div className="px-3 py-4 text-sm text-gray-500">
                  ไม่พบบ้านเลขที่นี้ในทะเบียนบ้านของหมู่บ้าน
                </div>
              )}
            </div>
          )}

          {!hasPending ? (
            <button type="button" onClick={switchToSuggest} className="text-sm font-medium text-amber-700 hover:underline">
              ไม่พบเลขบ้านของฉัน
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <input type="hidden" name="requestedHouseId" value="" />
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
              className="block w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100"
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
        <label htmlFor="note" className="mb-1 block text-sm font-medium text-gray-700">หมายเหตุ</label>
        <textarea
          id="note"
          name="note"
          defaultValue={latestRequest?.note ?? ""}
          rows={3}
          placeholder="รายละเอียดเพิ่มเติมสำหรับการพิจารณา"
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {actionState.fieldErrors?.house ? <p role="alert" className="text-sm text-red-700">{actionState.fieldErrors.house}</p> : null}
      {actionState.fieldErrors?.village ? <p role="alert" className="text-sm text-red-700">{actionState.fieldErrors.village}</p> : null}
      {actionState.message ? <p role="alert" className="text-sm text-red-700">{actionState.message}</p> : null}

      <button type="submit" disabled={!canSubmit || isPending || hasPending} className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50">
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
