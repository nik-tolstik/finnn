import Image from "next/image";

import styles from "./AppLoadingScreenConcepts.module.css";

interface AppLoadingScreenConceptProps {
  label?: string;
}

type Concept = "innerSweep" | "livingBalance" | "strokeAssembly";

function ConceptAnimation({ concept }: { concept: Concept }) {
  if (concept === "innerSweep") {
    return (
      <span className={`${styles.markMask} ${styles.sweepMask}`}>
        <span className={styles.sweepFill} />
      </span>
    );
  }

  if (concept === "strokeAssembly") {
    return (
      <>
        <span className={`${styles.markMask} ${styles.markCover}`} />
        <span className={`${styles.markMask} ${styles.assemblyLeft}`} />
        <span className={`${styles.markMask} ${styles.assemblyBridge}`} />
        <span className={`${styles.markMask} ${styles.assemblyRight}`} />
        <span className={`${styles.markMask} ${styles.assemblyComplete}`} />
      </>
    );
  }

  return (
    <span className={`${styles.markMask} ${styles.balanceMask}`}>
      <span className={`${styles.balanceBand} ${styles.balanceBandOne}`} />
      <span className={`${styles.balanceBand} ${styles.balanceBandTwo}`} />
      <span className={`${styles.balanceBand} ${styles.balanceBandThree}`} />
      <span className={`${styles.balanceBand} ${styles.balanceBandFour}`} />
    </span>
  );
}

function AppLoadingScreenConcept({
  concept,
  label = "Загрузка...",
}: AppLoadingScreenConceptProps & { concept: Concept }) {
  return (
    <div role="status" aria-live="polite" className={styles.screen}>
      <div aria-hidden="true" className={`${styles.scene} ${styles[concept]}`}>
        <div className={styles.logoFrame}>
          <Image src="/logo-dark.svg" alt="" width={180} height={180} className="block dark:hidden" priority />
          <Image src="/logo-light.svg" alt="" width={180} height={180} className="hidden dark:block" priority />
          <ConceptAnimation concept={concept} />
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function InnerSweepSplash(props: AppLoadingScreenConceptProps) {
  return <AppLoadingScreenConcept concept="innerSweep" {...props} />;
}

export function StrokeAssemblySplash(props: AppLoadingScreenConceptProps) {
  return <AppLoadingScreenConcept concept="strokeAssembly" {...props} />;
}

export function LivingBalanceSplash(props: AppLoadingScreenConceptProps) {
  return <AppLoadingScreenConcept concept="livingBalance" {...props} />;
}
