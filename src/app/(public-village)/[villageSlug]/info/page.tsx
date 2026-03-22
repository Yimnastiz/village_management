interface PageProps { params: Promise<{ villageSlug: string }> }
export default async function Page({ params }: PageProps) {
  const { villageSlug } = await params;
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">ข้อมูลหมู่บ้าน</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-gray-500">ข้อมูลของหมู่บ้าน {villageSlug}</p>
      </div>
    </div>
  );
}
