export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-green-800">ระบบหมู่บ้านอัจฉริยะ</h1>
          <p className="text-green-600 text-sm mt-1">Smart Village Management System</p>
        </div>
        {children}
      </div>
    </div>
  );
}
