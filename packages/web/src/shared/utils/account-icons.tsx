import {
  Banknote,
  BriefcaseBusiness,
  Building2,
  Coins,
  CreditCard,
  DollarSign,
  Euro,
  HandCoins,
  Handshake,
  Landmark,
  type LucideIcon,
  PiggyBank,
  ReceiptText,
  RussianRuble,
  Smartphone,
  TrendingUp,
  Vault,
  Wallet,
  WalletCards,
} from "lucide-react";
import type React from "react";
import type { ComponentProps, CSSProperties } from "react";
import { useId } from "react";

import { getAccountIconColors } from "@/shared/utils/account-icon-colors";
import { cn } from "@/shared/utils/cn";

type IconComponent =
  | LucideIcon
  | ((props: ComponentProps<"svg"> & { accountName?: string | null; initialFontSize?: number }) => React.JSX.Element);

function VisaIcon({ className, ...props }: ComponentProps<"svg">) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} {...props}>
      <path
        fill="currentColor"
        d="M13.967 13.837c-.766 0-1.186-.105-1.831-.37l-.239-.109-.271 1.575c.466.192 1.306.357 2.175.37 2.041 0 3.375-.947 3.391-2.404.016-.801-.51-1.409-1.621-1.91-.674-.325-1.094-.543-1.094-.873 0-.292.359-.603 1.109-.603a3.602 3.602 0 0 1 1.455.269l.18.08.271-1.522-.047.01a5.053 5.053 0 0 0-1.74-.297c-1.92 0-3.275.954-3.285 2.321-.012 1.005.964 1.571 1.701 1.908.757.345 1.01.562 1.008.872-.005.471-.605.683-1.162.683zm8.461-5.655h-1.5c-.467 0-.816.125-1.021.583l-2.885 6.44h2.041l.408-1.054 2.49.002c.061.246.24 1.052.24 1.052H24l-1.572-7.023zM20.03 12.71l.774-1.963c-.01.02.16-.406.258-.67l.133.606.449 2.027H20.03zM8.444 15.149h1.944l1.215-7.026H9.66v-.002zM4.923 12.971l-.202-.976v.003l-.682-3.226c-.117-.447-.459-.579-.883-.595H.025L0 8.325c.705.165 1.34.404 1.908.697a.392.392 0 0 1 .18.234l1.68 5.939h2.054l3.061-7.013H6.824l-1.901 4.789z"
      />
    </svg>
  );
}

function MastercardIcon({ className, ...props }: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <path fill="#FF5F00" d="M15.245 17.831h-6.49V6.168h6.49v11.663z"></path>
      <path
        fill="#EB001B"
        d="M9.167 12A7.404 7.404 0 0 1 12 6.169 7.417 7.417 0 0 0 0 12a7.417 7.417 0 0 0 11.999 5.831A7.406 7.406 0 0 1 9.167 12z"
      ></path>
      <path
        fill="#F79E1B"
        d="M24 12a7.417 7.417 0 0 1-12 5.831c1.725-1.358 2.833-3.465 2.833-5.831S13.725 7.527 12 6.169A7.417 7.417 0 0 1 24 12z"
      ></path>
    </svg>
  );
}

function BelkartIcon({ className, ...props }: ComponentProps<"svg">) {
  return (
    <svg viewBox="90 0 740 740" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <path
        fill="#32A8FF"
        d="M419.1 557.9 303.6 671.2c-7.7 7.6-7.6 17.3-5 23.9 2.7 6.6 9.4 13.6 20.2 13.7l203.3.6c15.6 0 28.6-12.6 28.9-28.3v-2.5c.1-44.5-17.5-88.1-48.8-119.9-22.6-22.9-59.9-23.3-83.1-.8ZM286.4 471.8l-161.8-1.6c-10.8-.1-17.7 6.9-20.4 13.4-2.8 6.6-3 16.3 4.6 24l143.3 144.2c11 11.1 29.2 11.3 40.4.4l1.8-1.8c31.6-31.4 49.9-74.7 50.3-119.3.4-32.3-25.7-59-58.2-59.9ZM130.3 449h2.5c44.5.1 88.1-17.5 119.9-48.8 23.2-22.7 23.5-60 .8-83.2L140.3 201.5c-7.6-7.7-17.3-7.6-23.9-5-6.6 2.7-13.6 9.4-13.7 20.2L102 420.1c0 15.7 12.7 28.6 28.3 28.9ZM161 192.3c31.4 31.6 74.7 49.9 119.3 50.3 32.4.3 59.1-25.8 59.4-58.3l1.6-161.8c.1-10.8-6.9-17.7-13.4-20.4-6.6-2.8-16.3-3-24 4.6L159.7 150.1c-11.1 11-11.3 29.2-.4 40.4l1.7 1.8ZM494.4 151.5 610 38.2c7.7-7.6 7.6-17.3 5-23.9-2.7-6.6-9.4-13.6-20.2-13.7L391.4 0c-15.6 0-28.6 12.6-28.9 28.3v2.5c-.1 44.5 17.5 88.1 48.8 119.9 22.7 23.2 60 23.5 83.1.8ZM627.1 237.7l161.8 1.6c10.8.1 17.7-6.9 20.4-13.4 2.8-6.6 3-16.3-4.6-24L661.4 57.7c-11-11.1-29.2-11.3-40.4-.4l-1.8 1.8c-31.6 31.4-49.9 74.7-50.3 119.3-.4 32.3 25.8 59 58.2 59.3ZM783.2 260.5h-2.5c-44.5-.1-88.1 17.5-119.9 48.8-23.2 22.7-23.5 60-.8 83.2L773.3 508c7.6 7.7 17.3 7.6 23.9 5 6.6-2.7 13.6-9.4 13.7-20.2l.6-203.3c.1-15.8-12.6-28.7-28.3-29ZM752.5 517.1c-31.4-31.6-74.7-49.9-119.3-50.3-32.4-.3-59.1 25.8-59.4 58.3l-1.6 161.8c-.1 10.8 6.9 17.7 13.4 20.4 6.6 2.8 16.3 3 24-4.6l144.2-143.3c11.1-11 11.3-29.2.4-40.4l-1.7-1.9Z"
      />
    </svg>
  );
}

function MirIcon({ className, ...props }: ComponentProps<"svg">) {
  const gradientId = useId();

  return (
    <svg viewBox="0 0 809 229" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <defs>
        <linearGradient id={gradientId} x1="570.9194" y1="47" x2="809" y2="47" gradientUnits="userSpaceOnUse">
          <stop offset="0.3" stopColor="#00B4E6" />
          <stop offset="1" stopColor="#088CCB" />
        </linearGradient>
      </defs>
      <path
        fill="#4DB45E"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M218 0v.1c-.1 0-31.6-.1-40 30-7.7 27.6-29.4 103.8-30 105.9h-6s-22.2-77.9-30-106C103.6-.1 72 0 72 0H0v229h72V93h3h3l42 136h50l42-135.9h6V229h72V0h-72Z"
      />
      <path
        fill="#4DB45E"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M481 0s-21.1 1.9-31 24l-51 112h-6V0h-72v229l68 0v0s22.1-2 32-24l50-112h6v136h72V0h-68Z"
      />
      <path
        fill="#4DB45E"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M581 104v125h72v-73h78c34 0 62.8-21.7 73.5-52H581Z"
      />
      <path
        fill={`url(#${gradientId})`}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M731 0H570.9c8 43.6 40.7 78.6 83 90 9.6 2.6 19.7 4 30.1 4h123.4c1.1-5.2 1.6-10.5 1.6-16C809 34.9 774.1 0 731 0Z"
      />
    </svg>
  );
}

function BitcoinIcon({ className, ...props }: ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      fill="none"
      viewBox="0 0 24 24"
      className={className}
      {...props}
    >
      <path
        fill="currentColor"
        d="M18.763 10.236c.28-1.895-1.155-2.905-3.131-3.591l.64-2.553-1.56-.389-.623 2.49-1.245-.297.631-2.508L11.915 3l-.641 2.562-.992-.234v-.01l-2.157-.54-.415 1.668s1.155.272 1.137.28c.631.163.74.578.722.903l-.722 2.923.162.054-.171-.036-1.02 4.087c-.072.19-.27.478-.712.36.018.028-1.128-.27-1.128-.27l-.776 1.778 2.03.505 1.11.289-.65 2.59 1.56.387.633-2.562 1.253.324-.64 2.554 1.56.388.641-2.59c2.662.505 4.665.308 5.505-2.102.676-1.94-.037-3.05-1.435-3.79 1.02-.225 1.786-.902 1.985-2.282zm-3.564 4.999c-.479 1.94-3.745.884-4.8.63l.857-3.436c1.055.27 4.448.784 3.943 2.796zm.478-5.026c-.433 1.76-3.158.866-4.033.65l.775-3.113c.885.217 3.718.632 3.258 2.463"
      />
    </svg>
  );
}

function InitialIcon({
  accountName,
  className,
  initialFontSize = 18,
  ...props
}: ComponentProps<"svg"> & { accountName?: string | null; initialFontSize?: number }) {
  const initial = Array.from(accountName?.trim() ?? "")[0]?.toUpperCase() || "A";

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} {...props}>
      <text
        x="12"
        y="12"
        dy="0.35em"
        textAnchor="middle"
        fill="currentColor"
        fontSize={initialFontSize}
        fontWeight="600"
      >
        {initial}
      </text>
    </svg>
  );
}

export type AccountIconColorMode = "adaptive" | "brand";

interface AccountIconDefinition {
  Icon: IconComponent;
  colorMode: AccountIconColorMode;
}

export const ACCOUNT_ICON_DEFINITIONS = {
  Initial: { Icon: InitialIcon, colorMode: "adaptive" },
  Wallet: { Icon: Wallet, colorMode: "adaptive" },
  WalletCards: { Icon: WalletCards, colorMode: "adaptive" },
  Banknote: { Icon: Banknote, colorMode: "adaptive" },
  Coins: { Icon: Coins, colorMode: "adaptive" },
  PiggyBank: { Icon: PiggyBank, colorMode: "adaptive" },
  CreditCard: { Icon: CreditCard, colorMode: "adaptive" },
  Smartphone: { Icon: Smartphone, colorMode: "adaptive" },
  Landmark: { Icon: Landmark, colorMode: "adaptive" },
  Building2: { Icon: Building2, colorMode: "adaptive" },
  Vault: { Icon: Vault, colorMode: "adaptive" },
  HandCoins: { Icon: HandCoins, colorMode: "adaptive" },
  Handshake: { Icon: Handshake, colorMode: "adaptive" },
  TrendingUp: { Icon: TrendingUp, colorMode: "adaptive" },
  BriefcaseBusiness: { Icon: BriefcaseBusiness, colorMode: "adaptive" },
  ReceiptText: { Icon: ReceiptText, colorMode: "adaptive" },
  BYN: { Icon: Banknote, colorMode: "adaptive" },
  USD: { Icon: DollarSign, colorMode: "adaptive" },
  EUR: { Icon: Euro, colorMode: "adaptive" },
  RUB: { Icon: RussianRuble, colorMode: "adaptive" },
  Visa: { Icon: VisaIcon, colorMode: "adaptive" },
  Mastercard: { Icon: MastercardIcon, colorMode: "brand" },
  Belkart: { Icon: BelkartIcon, colorMode: "brand" },
  Mir: { Icon: MirIcon, colorMode: "brand" },
  Bitcoin: { Icon: BitcoinIcon, colorMode: "adaptive" },
} as const satisfies Record<string, AccountIconDefinition>;

export type AccountIconName = keyof typeof ACCOUNT_ICON_DEFINITIONS;

// Keep the component-only registry for consumers that only need to enumerate icons.
export const ACCOUNT_ICONS = Object.fromEntries(
  Object.entries(ACCOUNT_ICON_DEFINITIONS).map(([name, definition]) => [name, definition.Icon])
) as Record<AccountIconName, IconComponent>;

export interface AccountIconProps extends ComponentProps<"svg"> {
  accountColor?: string | null;
  accountName?: string | null;
  iconName?: string | null;
  initialFontSize?: number;
}

export function getAccountIconDefinition(iconName?: string | null): AccountIconDefinition {
  if (iconName && iconName in ACCOUNT_ICON_DEFINITIONS) {
    return ACCOUNT_ICON_DEFINITIONS[iconName as AccountIconName];
  }

  return ACCOUNT_ICON_DEFINITIONS.HandCoins;
}

export function getAccountIcon(iconName?: string | null): IconComponent {
  return getAccountIconDefinition(iconName).Icon;
}

export function AccountIcon({
  accountColor,
  accountName,
  className,
  iconName,
  initialFontSize,
  style,
  ...props
}: AccountIconProps) {
  const definition = getAccountIconDefinition(iconName);
  const Icon = definition.Icon;
  const isAdaptive = definition.colorMode === "adaptive" && accountColor !== undefined;
  const iconColors = isAdaptive ? getAccountIconColors(accountColor) : null;
  const { color: _legacyColor, ...styleWithoutColor } = style ?? {};
  const iconStyle =
    isAdaptive && iconColors
      ? ({
          ...styleWithoutColor,
          "--account-icon-color-light": iconColors.light,
          "--account-icon-color-dark": iconColors.dark,
        } as CSSProperties)
      : style;
  const iconClassName = cn(className, isAdaptive && "account-icon-adaptive");

  const renderIcon = (nextClassName: string | undefined, nextStyle: CSSProperties | undefined) => {
    const iconProps = {
      ...props,
      className: nextClassName,
      style: nextStyle,
    };

    if (iconName === "Initial") {
      return <InitialIcon {...iconProps} accountName={accountName} initialFontSize={initialFontSize} />;
    }

    return <Icon {...iconProps} />;
  };

  if (definition.colorMode === "brand") {
    return renderIcon(className, style);
  }

  return renderIcon(iconClassName, iconStyle);
}
