import { useLayoutEffect, useState } from "react";

interface Breakpoints {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

const calculateBreakpoints = () => {
  return {
    isMobile: window.innerWidth < 768,
    isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
    isDesktop: window.innerWidth >= 1024,
  };
};

export function useBreakpoints() {
  const [breakpoints, setBreakpoints] = useState<Breakpoints>(calculateBreakpoints);

  useLayoutEffect(() => {
    const handleResize = () => setBreakpoints(calculateBreakpoints());

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return breakpoints;
}
