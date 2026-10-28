import { RouteLoading } from "@/components/RouteLoading";
import { lazy, Suspense, useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useMediaQuery } from "@mantine/hooks";
import { ThemeToggle } from "@/components/theme-toggle";

const DotLottieReact = lazy(() => import("@lottiefiles/dotlottie-react").then((module) => ({ default: module.DotLottieReact })));

export default function AuthLayout() {
  const showAnimation = useMediaQuery("(min-width: 1024px)");
  const [currentOrg, setCurrentOrg] = useState(0);

  const organizations = [
    { logo: "/css-logo.svg", name: "Computer Students' Society" },
    { logo: "/ssg2-logo.svg", name: "CIT-U Supreme Student Government" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentOrg((prev) => (prev + 1) % organizations.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [organizations.length]);


  return (
    <div className="h-screen flex font-sans text-[#293F55] dark:text-blue-100 transition-colors duration-300 overflow-hidden">
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up {
          animation: fadeUp 0.6s ease-out forwards;
          opacity: 0;
        }
        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-300 { animation-delay: 0.3s; }
      `}</style>

      {/* LEFT SIDE - BRANDING PANEL */}
      <div className="hidden lg:flex lg:w-5/12 relative overflow-hidden flex-col h-full"
        style={{ backgroundColor: '#293F55' }}>

        {/* Decorative Yellow Accent Sideline */}
        <div className="absolute left-0 top-0 bottom-0 w-2 bg-[#FCBD78] z-20 shadow-[0_0_15px_rgba(252,189,120,0.3)]"></div>

        {/* Top Content */}
        <div className="relative z-20 px-12 pt-12 pb-6">
          <div className="flex items-start gap-5 animate-fade-up delay-100 mb-6">
            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight">
              <span className="text-[#FCBD78]">Individual Performance</span>
              <br />Evaluation System
            </h1>
          </div>

          <p className="text-blue-100/80 text-lg leading-relaxed max-w-sm animate-fade-up delay-200">
            Ensuring transparency and excellence in student governance through data-driven assessment.
          </p>
        </div>

        {/* Middle Content - Adaptive Lottie Animation */}
        <div className="flex-1 flex items-center justify-center min-h-0 pointer-events-none relative z-10 px-6">
          <div className="w-full h-full max-w-[600px] max-h-[600px]">
            {showAnimation && (
              <Suspense fallback={null}>
                <DotLottieReact
                  src="/assets/anim_getthingsdone.json"
                  loop
                  autoplay
                  aria-hidden
                  className="w-full h-full object-contain transition-opacity duration-700"
                  renderConfig={{
                    autoResize: true
                  }}
                />
              </Suspense>
            )}
          </div>
        </div>

        {/* Bottom Content (Partners) */}
        <div className="relative z-20 px-12 pb-12 pt-6">
          <p className="text-[#FCBD78] text-xs font-bold uppercase tracking-wider mb-4">Authorized Partners</p>
          <div className="relative h-14">
            {organizations.map((org, index) => (
              <div
                key={index}
                className="flex items-center gap-4 absolute transition-all duration-700 ease-in-out w-full"
                style={{
                  opacity: index === currentOrg ? 1 : 0,
                  transform: index === currentOrg ? 'translateY(0)' : 'translateY(10px)',
                  pointerEvents: index === currentOrg ? 'auto' : 'none',
                }}
              >
                <div className="rounded-full flex items-center justify-center">
                  <img src={org.logo} alt="" className="w-10 h-10 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                </div>
                <span className="text-white font-medium text-sm border-l-2 border-[#FCBD78] pl-3">{org.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - CONTENT OUTLET */}
      <div className="flex-1 h-full flex items-center justify-center p-6 bg-[#293F55] lg:bg-[#F8FAFC] dark:lg:bg-slate-950 relative overflow-y-auto transition-colors duration-300">
        {/* Top Left Logo for Right Pane (Desktop/Tablet) */}
        <div className="hidden lg:flex absolute top-10 left-10 items-center gap-3 animate-fade-up">
          <img src="/ipes-logo-colored.svg" alt="IPES Logo" className="w-10 h-10 object-contain" />
          <span className="text-[#293F55] dark:text-blue-100 font-bold text-2xl tracking-tight">IPES</span>
        </div>

        {/* Top Right Theme Toggle */}
        <div className="absolute top-10 right-10 z-50 animate-fade-up">
          <ThemeToggle />
        </div>
        
        <Suspense fallback={<RouteLoading />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}

