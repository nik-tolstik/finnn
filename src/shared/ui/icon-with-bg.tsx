"use client";

import type { LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/shared/utils/cn";

type IconComponent = LucideIcon | ((props: ComponentProps<"svg">) => React.JSX.Element);

interface IconWithBgProps {
  icon: IconComponent;
  color?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  iconClassName?: string;
}

const sizeClasses = {
  sm: "h-5 w-5",
  md: "h-8 w-8 sm:h-10 sm:w-10",
  lg: "h-10 w-10",
};

const iconSizeClasses = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4 sm:h-5 sm:w-5",
  lg: "h-5 w-5",
};

export function IconWithBg({ icon: Icon, color, size = "md", className, iconClassName }: IconWithBgProps) {
  return (
    <div
      className={cn("flex items-center justify-center rounded-lg shrink-0", sizeClasses[size], className)}
      style={{
        backgroundColor: color ? `${color}20` : undefined,
      }}
    >
      <Icon
        className={cn(iconSizeClasses[size], iconClassName)}
        style={{
          color: color || undefined,
        }}
      />
    </div>
  );
}
