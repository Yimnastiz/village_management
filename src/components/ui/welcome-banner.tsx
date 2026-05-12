interface WelcomeBannerProps {
  villageName: string;
  userRole: "resident" | "headman" | "admin";
  userName?: string;
}

export function WelcomeBanner({ villageName, userRole, userName }: WelcomeBannerProps) {
  const getWelcomeMessage = () => {
    switch (userRole) {
      case "headman":
        return `ยินดีต้อนรับผู้ใหญ่บ้านหมู่บ้าน ${villageName}`;
      case "admin":
        return `ยินดีต้อนรับผู้ดูแลระบบหมู่บ้าน ${villageName}`;
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
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 to-green-700 px-6 py-8 text-white shadow-lg sm:px-8 sm:py-10">
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
        <p className="mt-2 text-green-100 sm:text-lg">
          {getSubMessage()}
        </p>
      </div>
    </div>
  );
}