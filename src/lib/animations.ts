/**
 * Centralized animation presets for Framer Motion.
 *
 * Import from here instead of inlining motion configs in every screen.
 * All presets use GPU-accelerated properties (opacity, transform) only.
 *
 * Usage:
 *   import { presets, variants, transition } from "@/lib/animations";
 *   <motion.div {...presets.fadeIn} />
 *   <motion.div variants={variants.staggerItem} />
 */

import type { Transition, Variants } from "motion/react";

// ── Easing curves ────────────────────────────────────────────────────────────

/** Material-style ease-out — decelerating entrance */
export const EASE_OUT = [0, 0, 0.2, 1] as const;
/** Material-style ease-in — accelerating exit */
export const EASE_IN = [0.4, 0, 1, 1] as const;
/** Material-style ease-in-out — symmetric movement */
export const EASE_IN_OUT = [0.4, 0, 0.2, 1] as const;

// ── Transition presets ───────────────────────────────────────────────────────

export const transition = {
  /** Quick fade/shift — 120ms ease-out. For micro-changes. */
  quick: { duration: 0.12, ease: EASE_OUT } satisfies Transition,
  /** Standard entrance — 200ms ease-out. Default for most UI. */
  enter: { duration: 0.2, ease: EASE_OUT } satisfies Transition,
  /** Standard exit — 150ms ease-in. */
  exit: { duration: 0.15, ease: EASE_IN } satisfies Transition,
  /** Page crossfade — 120ms in, 80ms out. */
  pageIn: { duration: 0.12, ease: EASE_OUT } satisfies Transition,
  pageOut: { duration: 0.08, ease: EASE_OUT } satisfies Transition,
  /** Spring — natural bounce for interactive elements. */
  spring: { type: "spring" as const, stiffness: 300, damping: 24 },
  /** Stiff spring — snappy, less bounce. */
  springStiff: { type: "spring" as const, stiffness: 500, damping: 30 },
  /** Bouncy spring — playful feel. */
  springBouncy: { type: "spring" as const, stiffness: 400, damping: 17 },
  /** Nav pill spring. */
  navPill: { type: "spring" as const, stiffness: 400, damping: 30 },
  /** Stagger child delay. */
  stagger: (i: number, ms = 0.04) => ({ delay: i * ms, duration: 0.2, ease: EASE_OUT }),
} as const;

// ── Direct animation presets (spread onto motion elements) ───────────────────
// Use for one-off animations where variants aren't needed.

export const presets = {
  /** Fade in. Standard entrance. */
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: transition.enter,
  },
  /** Fade in + scale up slightly. For cards, tooltips. */
  scaleIn: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.96 },
    transition: transition.enter,
  },
  /** Slide up from bottom. For sheets, bottom panels. */
  slideUp: {
    initial: { y: 24, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: 24, opacity: 0 },
    transition: transition.enter,
  },
  /** Slide down from top. For top sheets, dropdowns. */
  slideDown: {
    initial: { y: -16, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -16, opacity: 0 },
    transition: transition.enter,
  },
  /** Crossfade overlay. For backdrops. */
  overlay: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.12, ease: EASE_OUT },
  },
} as const;

// ── Variant-based presets (for parent-child orchestration) ───────────────────

/** Parent: orchestrates staggered children. */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.06,
    },
  },
};

/** Parent: faster stagger for tight lists (e.g. numpad, settings). */
export const staggerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.025,
      delayChildren: 0.03,
    },
  },
};

/** Parent: slower stagger for hero content. */
export const staggerSlow: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

/** Child: fade in. Use inside a stagger parent. */
export const staggerItem: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2, ease: EASE_OUT },
  },
};

/** Child: scale in. Use for cards/grid items. */
export const staggerScale: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: EASE_OUT },
  },
};

// ── Step motion (multi-step flows: send, stake, create vault) ────────────────

/**
 * Standard step transition for wizard-like flows.
 * Replaces the `stepMotion` objects duplicated across screens.
 */
export const stepMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: transition.enter,
} as const;

// ── Gesture presets ──────────────────────────────────────────────────────────

/** Hover scale up, tap scale down. For buttons and cards. */
export const gesture = {
  /** Standard press feedback — scale to 0.97. */
  press: {
    whileHover: { scale: 1.015 },
    whileTap: { scale: 0.97 },
    transition: transition.springStiff,
  },
  /** Subtle press feedback — scale to 0.98. */
  pressSubtle: {
    whileHover: { scale: 1.008 },
    whileTap: { scale: 0.98 },
    transition: transition.spring,
  },
  /** Button press — scale to 0.95 (strong feedback). */
  buttonPress: {
    whileTap: { scale: 0.95 },
    transition: transition.springStiff,
  },
  /** Lift on hover — scale up slightly. */
  lift: {
    whileHover: { scale: 1.02 },
    transition: transition.spring,
  },
} as const;

// ── Page transitions ─────────────────────────────────────────────────────────

export const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.08, ease: "easeOut" } },
  transition: { duration: 0.12, ease: "easeOut" },
} as const;
