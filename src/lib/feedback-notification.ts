export function feedbackNotificationTitle(category: string | null) {
  switch (category) {
    case "suggestion":
      return "มีข้อเสนอแนะใหม่";
    case "complaint":
      return "มีข้อร้องเรียนใหม่";
    case "bug":
      return "มีรายงานข้อผิดพลาดใหม่";
    default:
      return "มีความคิดเห็นใหม่";
  }
}
