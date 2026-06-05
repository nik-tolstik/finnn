import Image from "next/image";

interface AppLoadingScreenProps {
  label?: string;
}

export function AppLoadingScreen({ label = "Загрузка..." }: AppLoadingScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative size-14">
          <Image src="/logo-dark.svg" alt="Finnn" fill className="block dark:hidden" priority />
          <Image src="/logo-light.svg" alt="Finnn" fill className="hidden dark:block" priority />
        </div>
        <div className="space-y-1">
          <div className="text-2xl font-semibold">Finnn</div>
          <div className="text-sm text-muted-foreground">{label}</div>
        </div>
      </div>
    </div>
  );
}
