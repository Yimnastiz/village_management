export type CommunityProfile = {
  history: [string, string];
  highlights: { title: string; description: string; kind: "landmark" | "tradition" | "community" }[];
  transport: string;
  attribution: string;
};

/**
 * Curated public context is deliberately scoped to the one catalog identity it
 * describes. Other Villages continue to use their editable Village description.
 */
export function getCommunityProfile(officialCode: string | null | undefined): CommunityProfile | null {
  if (officialCode !== "66080210") return null;

  return {
    history: [
      "บ้านเขาทรายเป็นชุมชนเก่าแก่ของตำบลเขาทราย อำเภอทับคล้อ จังหวัดพิจิตร ชื่อ “เขาทราย” มีที่มาจากลักษณะภูมิประเทศที่มีภูเขาและพื้นที่หินทราย ชุมชนมีวิถีชีวิตผูกพันกับการเกษตรและพระพุทธศาสนา โดยมีวัดพระพุทธบาทเขาทรายเป็นหนึ่งในศาสนสถานสำคัญของชุมชน",
      "ประเพณีตักบาตรเทโวโรหณะเป็นประเพณีสำคัญของพื้นที่เขาทรายที่สืบทอดต่อกันมายาวนาน และเป็นหนึ่งในเอกลักษณ์ทางวัฒนธรรมของอำเภอทับคล้อ",
    ],
    highlights: [
      { title: "วัดพระพุทธบาทเขาทราย", description: "ศาสนสถานสำคัญของบ้านเขาทราย หมู่ 10 และเป็นศูนย์รวมจิตใจของคนในชุมชน", kind: "landmark" },
      { title: "ประเพณีตักบาตรเทโว", description: "ประเพณีสำคัญที่จัดสืบต่อกันในพื้นที่เขาทรายหลังช่วงออกพรรษา", kind: "tradition" },
      { title: "ชุมชนเกษตรกรรม", description: "วิถีชีวิตดั้งเดิมของชุมชนสัมพันธ์กับการทำนาและทำไร่", kind: "community" },
    ],
    transport: "ชุมชนเชื่อมต่อกับทางหลวงหมายเลข 113 สายเขาทราย–เพชรบูรณ์",
    attribution: "ข้อมูลประกอบ: ข้อมูลประวัติท้องถิ่นอำเภอทับคล้อ และข้อมูลชุมชนวัดเขาทราย",
  };
}
