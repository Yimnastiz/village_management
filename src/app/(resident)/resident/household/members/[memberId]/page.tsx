interface PageProps { params: Promise<{ memberId: string }> }
export default async function MemberDetailPage({ params }: PageProps) {
  const { memberId } = await params;
  return <div className="space-y-6"><h1 className="text-2xl font-bold text-gray-900">ข้อมูลสมาชิก #{memberId}</h1><div className="bg-white rounded-xl border border-gray-200 p-6"><p className="text-gray-500">รายละเอียดสมาชิกในครัวเรือน</p></div></div>;
}
