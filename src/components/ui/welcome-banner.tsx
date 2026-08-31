interface WelcomeBannerProps {
  villageName: string;
  userRole: "resident" | "headman" | "assistant" | "admin" | "superadmin";
  userName?: string;
  area?: "admin" | "resident";
}

export function WelcomeBanner({ villageName, userRole, userName, area }: WelcomeBannerProps) {
  const getWelcomeMessage = () => {
    switch (userRole) {
      case "headman":
        return `ยินดีต้อนรับผู้ใหญ่บ้าน ${villageName}`;
      case "assistant":
        return `ยินดีต้อนรับผู้ช่วยผู้ใหญ่บ้าน ${villageName}`;
      case "admin":
        return `ยินดีต้อนรับผู้ดูแลระบบ ${villageName}`;
      case "superadmin":
        return `ยินดีต้อนรับซูเปอร์แอดมิน ${villageName}`;
      default:
        return `ยินดีต้อนรับเข้าสู่หมู่บ้าน ${villageName}`;
    }
  };

  const getSubMessage = () => {
    if (userName) {
      return `สวัสดี ${userName}`;
    }
    return "เริ่มต้นใช้งานระบบหมู่บ้านอัจฉริยะ";
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r px-6 py-8 text-white shadow-lg sm:px-8 sm:py-10 ${area === "admin" ? "from-blue-700 to-blue-800" : "from-green-600 to-green-700"}`}>
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
          <g fill="none" fillRule="evenodd">
            <g fill="#ffffff" fillOpacity="0.1">
              <circle cx="30" cy="30" r="4"/>
            </g>
          </g>
        </svg>
      </div>

      <div className="relative">
        <h1 className="text-2xl font-bold sm:text-3xl lg:text-4xl">
          {getWelcomeMessage()}
        </h1>
        <p className={`mt-2 sm:text-lg ${area === "admin" ? "text-blue-100" : "text-green-100"}`}>
          {getSubMessage()}
        </p>
      </div>
    </div>
  );
}
