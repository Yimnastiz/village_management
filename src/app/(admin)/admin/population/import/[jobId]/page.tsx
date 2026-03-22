interface PageProps { params: Promise<{ jobId: string }> }
export default async function Page({ params }: PageProps) {
  const { jobId } = await params;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">ผลการนำเข้า</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-gray-500">ID: {jobId}</p>
      </div>
    </div>
  );
}
