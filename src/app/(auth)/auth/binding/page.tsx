import Link from "next/link";
import { BindingRequestStatus } from "@prisma/client";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { submitBindingRequestAction } from "./actions";

export default async function BindingPage() {
  const session = await getSessionContextFromServerCookies();

  const villages = await prisma.village.findMany({
    where: { isActive: true },
    orderBy: [{ province: "asc" }, { district: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      province: true,
      district: true,
      subdistrict: true,
    },
  });

  const latestRequest = session
    ? await prisma.bindingRequest.findFirst({
        where: { userId: session.id },
        orderBy: { createdAt: "desc" },
        include: {
          house: {
            select: {
              houseNumber: true,
            },
          },
          village: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })
    : null;

  const hasPending = latestRequest?.status === BindingRequestStatus.PENDING;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Bind Account to Village</h2>
        <p className="text-sm text-gray-500 mb-6">
          If your phone number is not pre-verified in dev phone seeds, submit a binding request for approval.
        </p>
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {session ? (
            <>
              Logged in as <strong>{session.name || session.phoneNumber}</strong>.
              You can submit a binding request below.
            </>
          ) : (
            <>You can view this page without login. To submit a binding request, please log in first.</>
          )}
        </div>

        {hasPending && (
          <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            คุณมีคำขอผูกบ้านที่รออนุมัติอยู่แล้ว ระบบจะไม่สร้างคำขอใหม่ซ้ำ แต่จะอัปเดตเลขบ้านและหมายเหตุในคำขอเดิมแทน
          </div>
        )}

        <form action={submitBindingRequestAction} className="space-y-4">
          <div>
            <label htmlFor="villageId" className="mb-1 block text-sm font-medium text-gray-700">
              Village
            </label>
            {hasPending && latestRequest?.villageId && (
              <input type="hidden" name="villageId" value={latestRequest.villageId} />
            )}
            <select
              id="villageId"
              name="villageId"
              required
              defaultValue={latestRequest?.villageId ?? ""}
              disabled={hasPending}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select village</option>
              {villages.map((village) => (
                <option key={village.id} value={village.id}>
                  {village.name} ({[village.subdistrict, village.district, village.province]
                    .filter(Boolean)
                    .join(" / ")})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="houseNumber" className="mb-1 block text-sm font-medium text-gray-700">
              House Number
            </label>
            <input
              id="houseNumber"
              name="houseNumber"
              defaultValue={latestRequest?.houseNumber ?? latestRequest?.house?.houseNumber ?? ""}
              placeholder="e.g. 123/4"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="note" className="mb-1 block text-sm font-medium text-gray-700">
              Note
            </label>
            <textarea
              id="note"
              name="note"
              defaultValue={latestRequest?.note ?? ""}
              rows={3}
              placeholder="Additional details for approval"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            {hasPending ? "อัปเดตคำขอผูกบ้านเดิม" : "Submit Binding Request"}
          </button>

          {!session && (
            <p className="mt-2 text-sm text-gray-600">
              You must {" "}
              <Link
                href={`/auth/login?callbackUrl=${encodeURIComponent("/auth/binding")}`}
                className="text-green-600 font-medium hover:underline"
              >
                log in
              </Link>{" "}
              to submit a binding request.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
