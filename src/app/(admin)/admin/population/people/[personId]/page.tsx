interface PageProps { params: Promise<{ personId: string }> }
export default async function Page({ params }: PageProps) {
  const { personId } = await params;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">ข้อมูลบุคคล</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-gray-500">ID: {personId}</p>
      </div>
    </div>
  );
}
