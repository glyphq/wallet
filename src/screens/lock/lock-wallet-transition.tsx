import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { transition } from "@/lib/animations";
import type { WalletMeta } from "@/store/persisted";
import { LockWalletFocus } from "./lock-wallet-focus";

export type WalletChangeDirection = -1 | 1;

/** Slide a full card width plus a hair, so rotation never leaves a sliver on screen. */
const SLIDE = 103;
const ROTATE = 2;
const SCALE = 0.98;

const slideVariants: Variants = {
  enter: (direction: WalletChangeDirection) => ({
    x: `${direction * SLIDE}%`,
    rotate: direction * ROTATE,
    scale: SCALE,
    opacity: 0,
  }),
  center: {
    x: "0%",
    rotate: 0,
    scale: 1,
    opacity: 1,
    transition: transition.enter,
  },
  exit: (direction: WalletChangeDirection) => ({
    x: `${direction * -SLIDE}%`,
    rotate: direction * -ROTATE,
    scale: SCALE,
    opacity: 0,
    transition: transition.enter,
  }),
};

const fadeVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: transition.quick },
  exit: { opacity: 0, transition: transition.quick },
};

/**
 * Swaps the whole locked-wallet card when the selection changes.
 *
 * `AnimatePresence custom` is deliberately passed the current direction: the
 * outgoing card keeps its previous render's props, so using the component prop
 * directly in `exit` made a left/right switch replay the previous direction.
 */
export function LockWalletTransition({
  wallet,
  direction,
  animateOnMount = false,
}: {
  wallet: WalletMeta;
  direction: WalletChangeDirection;
  /** Play the entrance on first mount, for shelf selections returning to the unlock view. */
  animateOnMount?: boolean;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        width: "100%",
        overflow: "hidden",
        paddingBlock: "var(--space-2)",
      }}
    >
      <AnimatePresence mode="sync" custom={direction} initial={animateOnMount}>
        <motion.div
          key={wallet.id}
          custom={direction}
          variants={reduceMotion ? fadeVariants : slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          style={{ gridArea: "1 / 1", width: "100%", willChange: "transform, opacity" }}
        >
          <LockWalletFocus wallet={wallet} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
