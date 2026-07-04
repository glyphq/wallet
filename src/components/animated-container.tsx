/**
 * Reusable animated wrapper components.
 * Built on top of the centralized presets from @/lib/animations.
 */

import { type ReactNode, type CSSProperties, useRef } from "react";
import { motion, useInView } from "motion/react";
import { presets, staggerContainer, staggerItem, transition } from "@/lib/animations";

// ── AnimatedContainer ────────────────────────────────────────────────────────

interface AnimatedContainerProps {
  children: ReactNode;
  animation?: "fadeIn" | "scaleIn" | "slideUp" | "slideDown";
  delay?: number;
  style?: CSSProperties;
  className?: string;
}

/**
 * Wrapper that animates children on mount.
 * Use for page sections, cards, and standalone content blocks.
 */
export function AnimatedContainer({
  children,
  animation = "fadeIn",
  delay = 0,
  style,
  className,
}: AnimatedContainerProps) {
  const preset = presets[animation];
  return (
    <motion.div
      initial={preset.initial}
      animate={preset.animate}
      exit={preset.exit}
      transition={delay ? { ...preset.transition, delay } : preset.transition}
      style={style}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── StaggerList ──────────────────────────────────────────────────────────────

interface StaggerListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  keyExtractor: (item: T, index: number) => string;
  stagger?: "default" | "fast" | "slow";
  style?: CSSProperties;
  className?: string;
  as?: "div" | "ul" | "ol";
}

/**
 * Staggered list entrance animation.
 * Parent fades in, children animate one by one with a slight delay.
 */
export function StaggerList<T>({
  items,
  renderItem,
  keyExtractor,
  style,
  className,
  as = "div",
}: StaggerListProps<T>) {
  const Container = motion[as] ?? motion.div;
  return (
    <Container
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      style={style}
      className={className}
    >
      {items.map((item, i) => (
        <motion.div key={keyExtractor(item, i)} variants={staggerItem}>
          {renderItem(item, i)}
        </motion.div>
      ))}
    </Container>
  );
}

// ── FadeInView (scroll-triggered) ────────────────────────────────────────────

interface FadeInViewProps {
  children: ReactNode;
  delay?: number;
  style?: CSSProperties;
  className?: string;
}

/**
 * Fades in when scrolled into view. Uses IntersectionObserver (via useInView).
 * Good for long scrollable content like settings pages.
 */
export function FadeInView({ children, delay = 0, style, className }: FadeInViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      transition={{ duration: 0.25, ease: [0, 0, 0.2, 1], delay }}
      style={style}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Pressable ────────────────────────────────────────────────────────────────

interface PressableProps {
  children: ReactNode;
  onPress?: () => void;
  style?: CSSProperties;
  className?: string;
  /** Strength of the press feedback. */
  intensity?: "default" | "subtle" | "strong";
  disabled?: boolean;
  ariaLabel?: string;
  type?: "button" | "submit";
}

/**
 * Animated pressable element with scale feedback on tap.
 * Wraps a motion.button with spring-based press animation.
 */
export function Pressable({
  children,
  onPress,
  style,
  className,
  intensity = "default",
  disabled,
  ariaLabel,
  type = "button",
}: PressableProps) {
  const scale = intensity === "strong" ? 0.95 : intensity === "subtle" ? 0.98 : 0.97;
  return (
    <motion.button
      type={type}
      onClick={onPress}
      disabled={disabled}
      aria-label={ariaLabel}
      whileHover={disabled ? undefined : { scale: 1.015 }}
      whileTap={disabled ? undefined : { scale }}
      transition={transition.springStiff}
      style={style}
      className={className}
    >
      {children}
    </motion.button>
  );
}

// ── AnimatedNumber ───────────────────────────────────────────────────────────

interface AnimatedNumberProps {
  value: string;
  style?: CSSProperties;
}

/**
 * Subtle scale pulse when the displayed value changes.
 * Good for balance displays, counters, etc.
 */
export function AnimatedNumber({ value, style }: AnimatedNumberProps) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0.6, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
      style={style}
    >
      {value}
    </motion.span>
  );
}
