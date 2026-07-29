import { ArrowLeftRight, ChartNoAxesCombined, WalletCards } from "lucide-react";
import Image from "next/image";

import styles from "./AppLoadingScreen.module.css";

interface AppLoadingScreenProps {
  label?: string;
}

export function AppLoadingScreen({ label = "Загрузка..." }: AppLoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`${styles.screen} flex items-center justify-center overflow-hidden bg-background px-6`}
    >
      <div aria-hidden="true" className={styles.scene}>
        <div className={styles.glow} />
        <div className={styles.outerOrbit} />
        <div className={styles.innerOrbit} />
        <div className={styles.orbitSweep} />

        <div className={styles.logoShell}>
          <Image src="/logo-dark.svg" alt="" width={72} height={72} className="block dark:hidden" priority />
          <Image src="/logo-light.svg" alt="" width={72} height={72} className="hidden dark:block" priority />
        </div>

        <div className={`${styles.node} ${styles.accountsNode}`}>
          <WalletCards className="size-5" strokeWidth={1.8} />
        </div>
        <div className={`${styles.node} ${styles.transferNode}`}>
          <ArrowLeftRight className="size-5" strokeWidth={1.8} />
        </div>
        <div className={`${styles.node} ${styles.analyticsNode}`}>
          <ChartNoAxesCombined className="size-5" strokeWidth={1.8} />
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
