export default function InfoPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">ข้อมูลโครงการ</h1>
      <div className="prose prose-gray max-w-none">
        <p className="text-gray-600 leading-relaxed">
          ระบบบริหารจัดการหมู่บ้านอัจฉริยะ (Smart Village Management System)
          คือแพลตฟอร์มดิจิทัลสำหรับชุมชนในประเทศไทย ที่ช่วยให้การบริหารจัดการหมู่บ้าน
          มีความโปร่งใส มีประสิทธิภาพ และเชื่อมต่อลูกบ้านกับผู้นำชุมชนได้ดียิ่งขึ้น
        </p>
        <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">วัตถุประสงค์</h2>
        <ul className="space-y-2 text-gray-600">
          <li>• เพิ่มประสิทธิภาพการบริหารจัดการหมู่บ้าน</li>
          <li>• ส่งเสริมความโปร่งใสในการใช้งบประมาณและโครงการ</li>
          <li>• อำนวยความสะดวกให้แก่ลูกบ้านในการเข้าถึงบริการ</li>
          <li>• สร้างช่องทางสื่อสารระหว่างชุมชนและผู้นำ</li>
          <li>• ระบบแจ้งเหตุฉุกเฉินที่ทันสมัย</li>
        </ul>
        <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">กลุ่มเป้าหมาย</h2>
        <ul className="space-y-2 text-gray-600">
          <li>• ลูกบ้านและสมาชิกในชุมชน</li>
          <li>• ผู้ใหญ่บ้านและผู้ช่วยผู้ใหญ่บ้าน</li>
          <li>• คณะกรรมการหมู่บ้าน</li>
          <li>• หน่วยงานที่เกี่ยวข้องในพื้นที่</li>
        </ul>
      </div>
    </div>
  );
}
