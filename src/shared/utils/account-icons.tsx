import { CreditCard, type LucideIcon, HandCoins, Landmark, Wallet } from "lucide-react";
import type { ComponentProps } from "react";

type IconComponent = LucideIcon | ((props: ComponentProps<"svg">) => JSX.Element);

function VisaIcon({ className, ...props }: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path fill="#3C58BF" d="m23.6 41 3.2-18h5l-3.1 18z"></path>
      <path fill="#293688" d="m23.6 41 4.1-18h4.1l-3.1 18z"></path>
      <path fill="#3C58BF" d="M46.8 23.2c-1-.4-2.6-.8-4.6-.8-5 0-8.6 2.5-8.6 6.1 0 2.7 2.5 4.1 4.5 5 2 .9 2.6 1.5 2.6 2.3 0 1.2-1.6 1.8-3 1.8-2 0-3.1-.3-4.8-1l-.7-.3-.7 4.1c1.2.5 3.4 1 5.7 1 5.3 0 8.8-2.5 8.8-6.3 0-2.1-1.3-3.7-4.3-5-1.8-.9-2.9-1.4-2.9-2.3 0-.8.9-1.6 2.9-1.6 1.7 0 2.9.3 3.8.7l.5.2.8-3.9z"></path>
      <path fill="#293688" d="M46.8 23.2c-1-.4-2.6-.8-4.6-.8-5 0-7.7 2.5-7.7 6.1 0 2.7 1.6 4.1 3.6 5 2 .9 2.6 1.5 2.6 2.3 0 1.2-1.6 1.8-3 1.8-2 0-3.1-.3-4.8-1l-.7-.3-.7 4.1c1.2.5 3.4 1 5.7 1 5.3 0 8.8-2.5 8.8-6.3 0-2.1-1.3-3.7-4.3-5-1.8-.9-2.9-1.4-2.9-2.3 0-.8.9-1.6 2.9-1.6 1.7 0 2.9.3 3.8.7l.5.2.8-3.9z"></path>
      <path fill="#3C58BF" d="M55.4 23c-1.2 0-2.1.1-2.6 1.3L45.3 41h5.4l1-3h6.4l.6 3h4.8l-4.2-18h-3.9zm-2.3 12c.3-.9 2-5.3 2-5.3s.4-1.1.7-1.8l.3 1.7s1 4.5 1.2 5.5h-4.2V35z"></path>
      <path fill="#293688" d="M56.6 23c-1.2 0-2.1.1-2.6 1.3L45.3 41h5.4l1-3h6.4l.6 3h4.8l-4.2-18h-2.7zm-3.5 12c.4-1 2-5.3 2-5.3s.4-1.1.7-1.8l.3 1.7s1 4.5 1.2 5.5h-4.2V35z"></path>
      <path fill="#3C58BF" d="m14.4 35.6-.5-2.6c-.9-3-3.8-6.3-7-7.9l4.5 16h5.4l8.1-18h-5.4l-5.1 12.5z"></path>
      <path fill="#293688" d="m14.4 35.6-.5-2.6c-.9-3-3.8-6.3-7-7.9l4.5 16h5.4l8.1-18h-4.4l-6.1 12.5z"></path>
      <path fill="#FFBC00" d="m.5 23 .9.2c6.4 1.5 10.8 5.3 12.5 9.8l-1.8-8.5c-.3-1.2-1.2-1.5-2.3-1.5H.5z"></path>
      <path fill="#F7981D" d="M.5 23c6.4 1.5 11.7 5.4 13.4 9.9l-1.7-7.1c-.3-1.2-1.3-1.9-2.4-1.9L.5 23z"></path>
      <path fill="#ED7C00" d="M.5 23c6.4 1.5 11.7 5.4 13.4 9.9L12.7 29c-.3-1.2-.7-2.4-2.1-2.9L.5 23z"></path>
    </svg>
  );
}

function MastercardIcon({ className, ...props }: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path fill="#FF5F00" d="M15.245 17.831h-6.49V6.168h6.49v11.663z"></path>
      <path fill="#EB001B" d="M9.167 12A7.404 7.404 0 0 1 12 6.169 7.417 7.417 0 0 0 0 12a7.417 7.417 0 0 0 11.999 5.831A7.406 7.406 0 0 1 9.167 12z"></path>
      <path fill="#F79E1B" d="M24 12a7.417 7.417 0 0 1-12 5.831c1.725-1.358 2.833-3.465 2.833-5.831S13.725 7.527 12 6.169A7.417 7.417 0 0 1 24 12z"></path>
    </svg>
  );
}

export const ACCOUNT_ICONS: Record<string, IconComponent> = {
  Wallet,
  HandCoins,
  CreditCard,
  Landmark,
  Visa: VisaIcon,
  Mastercard: MastercardIcon,
} as const;

export type AccountIconName = keyof typeof ACCOUNT_ICONS;

export function getAccountIcon(iconName?: string | null): IconComponent {
  if (iconName && iconName in ACCOUNT_ICONS) {
    return ACCOUNT_ICONS[iconName as AccountIconName];
  }

  return HandCoins;
}
