import {
  BriefcaseBusiness,
  Building2,
  Car,
  Coffee,
  CreditCard,
  HandCoins,
  Landmark,
  type LucideIcon,
  PiggyBank,
  ShoppingCart,
  Tv,
  Wallet,
} from "lucide-react";
import type { ComponentProps } from "react";

import { getApiBaseUrl } from "@/shared/api/http-client";
import { cn } from "@/shared/utils/cn";

const LEGACY_CATEGORY_ICONS: Record<string, LucideIcon> = {
  briefcase: BriefcaseBusiness,
  "briefcase-business": BriefcaseBusiness,
  "building-2": Building2,
  car: Car,
  coffee: Coffee,
  "credit-card": CreditCard,
  "hand-coins": HandCoins,
  landmark: Landmark,
  "piggy-bank": PiggyBank,
  "shopping-cart": ShoppingCart,
  tv: Tv,
  wallet: Wallet,
};

export interface CategoryIconProps extends Omit<ComponentProps<"span">, "children" | "ref"> {
  icon?: string | null;
  iconAssetId?: string | null;
  iconAssetUrl?: string | null;
  imageAlt?: string;
}

function getAssetUrl(iconAssetId: string, iconAssetUrl?: string | null) {
  const path = iconAssetUrl || `/category-icons/${iconAssetId}`;
  return new URL(path, `${getApiBaseUrl()}/`).toString();
}

export function isCategoryEmojiValue(value: string | null | undefined): boolean {
  return Boolean(value && /\p{Extended_Pictographic}/u.test(value) && !/[\p{L}\p{N}]/u.test(value));
}

export function CategoryIcon({
  className,
  icon,
  iconAssetId,
  iconAssetUrl,
  imageAlt = "",
  ...props
}: CategoryIconProps) {
  if (iconAssetId) {
    return (
      <img
        src={getAssetUrl(iconAssetId, iconAssetUrl)}
        alt={imageAlt}
        className={cn("size-5 shrink-0 object-cover", className)}
        aria-hidden={imageAlt ? undefined : true}
      />
    );
  }

  const normalizedIcon = icon?.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  const LegacyIcon = normalizedIcon ? LEGACY_CATEGORY_ICONS[normalizedIcon] : undefined;
  if (LegacyIcon) {
    return <LegacyIcon className={cn("size-5 shrink-0 text-muted-foreground", className)} aria-hidden="true" />;
  }

  if (!isCategoryEmojiValue(icon)) {
    return (
      <span
        {...props}
        role="img"
        data-icon="square-help"
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded bg-muted text-sm font-medium text-muted-foreground",
          className
        )}
        title="Иконка не выбрана"
        aria-label="Иконка не выбрана"
      >
        ?
      </span>
    );
  }

  return (
    <span
      {...props}
      className={cn("inline-flex size-5 shrink-0 items-center justify-center text-base leading-none", className)}
    >
      {icon}
    </span>
  );
}
