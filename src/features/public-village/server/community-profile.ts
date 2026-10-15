export type CommunityProfile = {
  history: string[];
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
      "บ้านเขาทราย หมู่ 10 เป็นชุมชนของตำบลเขาทราย อำเภอทับคล้อ จังหวัดพิจิตร โดยมีวัดพระพุทธบาทเขาทราย หรือวัดเขาทราย เป็นศูนย์กลางทางศาสนาและวัฒนธรรมของชุมชน วัดตั้งอยู่บริเวณเชิงเขาและประกาศตั้งวัดราว พ.ศ. 2474 ภายในมีรอยพระพุทธบาทจำลองและศาสนสถานสำคัญหลายแห่ง",
      "ชุมชนเขาทรายมีประเพณีตักบาตรเทโวโรหณะเป็นหนึ่งในเอกลักษณ์สำคัญ ซึ่งสืบทอดต่อกันมาหลายสิบปีหลังช่วงออกพรรษา และมีผู้คนจากพื้นที่ใกล้เคียงมาร่วมงาน",
      "ด้านการศึกษา บ้านเขาทรายมีโรงเรียนวัดเขาทรายตั้งอยู่ในหมู่ 10 ซึ่งมีประวัติการจัดการศึกษามาตั้งแต่ พ.ศ. 2482 สะท้อนบทบาทของวัด โรงเรียน และชุมชนที่เชื่อมโยงกันมาอย่างต่อเนื่อง",
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
