import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

export default async function Page() {
  const session = await getSessionContextFromServerCookies();
  const notifications = session
    ? await prisma.notification.findMany({
        where: { userId: session.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">การแจ้งเตือน</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        {notifications.length === 0 ? (
          <p className="text-gray-500 text-center">ไม่มีการแจ้งเตือน</p>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="rounded-lg border border-gray-100 bg-gray-50 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{notification.title}</p>
                    <p className="text-sm text-gray-600">{notification.body}</p>
                  </div>
                  <div className="text-xs text-gray-400">
                      {new Date(notification.createdAt).toLocaleString()}
                    </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
