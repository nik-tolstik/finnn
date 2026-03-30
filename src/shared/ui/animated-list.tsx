"use client";

import { motion, type MotionProps } from "motion/react";
import type React from "react";

import { cn } from "@/shared/utils/cn";

export function AnimatedListItem({ children, className }: { children: React.ReactNode; className?: string }) {
  const animations: MotionProps = {
    initial: { scaleY: 0, opacity: 0 },
    animate: { scaleY: 1, opacity: 1, originY: 0 },
    exit: { scale: 0, opacity: 0 },
    transition: { type: "spring", stiffness: 350, damping: 40 },
  };

  return (
    <motion.div {...animations} className={cn("mx-auto w-full", className)}>
      {children}
    </motion.div>
  );
}
