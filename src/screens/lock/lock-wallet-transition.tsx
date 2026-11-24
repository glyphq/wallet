import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { transition } from "@/lib/animations";
import type { WalletMeta } from "@/store/persisted";
import { LockWalletFocus } from "./lock-wallet-focus";

export type WalletChangeDirection = -1 | 1;

/** Slide a full card width plus a hair, so rotation never leaves a sliver on screen. */
const SLIDE = 103;
const ROTATE = 2;
const SCALE = 0.98;

/**
 * Swaps the whole locked-wallet card when the selection changes.
 *
 * The outgoing card slides fully out to one side while the incoming card slides
 * in from the other, both rendered together (AnimatePresence `sync`). The cards
 * share one grid cell, so the row keeps the taller card's height for the whole
 * transition and the surrounding arrows never move. The wrapper clips the slide
 * and keeps vertical slack so the subtle rotation is not cut off.
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
      <AnimatePresence mode="sync" initial={animateOnMount}>
        <motion.div
          key={wallet.id}
          initial={reduceMotion
            ? { opacity: 0 }
            : { x: `${direction * SLIDE}%`, rotate: direction * ROTATE, scale: SCALE }}
          animate={reduceMotion
            ? { opacity: 1, transition: transition.quick }
            : { x: "0%", rotate: 0, scale: 1, transition: transition.enter }}
          exit={reduceMotion
            ? { opacity: 0, transition: transition.quick }
            : { x: `${direction * -SLIDE}%`, rotate: direction * -ROTATE, scale: SCALE, transition: transition.enter }}
          style={{ gridArea: "1 / 1", width: "100%", willChange: "transform, opacity" }}
        >
          <LockWalletFocus wallet={wallet} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
