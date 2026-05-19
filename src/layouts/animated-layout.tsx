import { useLocation, useOutlet } from "react-router-dom";
import { AnimatePresence, motion, type Transition } from "motion/react";

const PAGE_VARIANTS = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
};

const PAGE_TRANSITION: Transition = { duration: 0.15, ease: "easeOut" };

export function AnimatedLayout() {
  const location = useLocation();
  const element = useOutlet();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.key}
        variants={PAGE_VARIANTS}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={PAGE_TRANSITION}
        style={{ height: "100%", position: "absolute", inset: 0 }}
      >
        {element}
      </motion.div>
    </AnimatePresence>
  );
}
