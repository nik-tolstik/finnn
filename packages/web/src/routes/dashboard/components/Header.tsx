import { MobileUserMenu } from "./MobileUserMenu";

export function Header() {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center bg-background">
      <div className="flex items-center justify-between px-4 sm:px-8 w-full">
        <div className="flex items-center justify-end gap-4 flex-1">
          <MobileUserMenu />
        </div>
      </div>
    </header>
  );
}
