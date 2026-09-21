# 001 — Snap the Locus Focus toggle

- **Status**: TODO
- **Commit**: 0c57c41
- **Severity**: HIGH
- **Category**: Purpose & frequency; cohesion & physicality
- **Estimated scope**: 1 file, small

## Problem

The Locus Focus launcher and panel are two independent `AnimatePresence`
trees in a fixed-bottom flex stack. Opening the panel mounts it above the
launcher while the launcher is simultaneously removed with `mode="popLayout"`.
The pill's exit changes the stack's height and anchor during the panel's own
transform animation, creating the visible upward jump.

```tsx
// components/locus-chat.tsx:63 — current
<AnimatePresence initial={false}>
  {isOpen ? (
    <motion.section
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 10 }}
      initial={{ opacity: 0, scale: 0.96, y: 10 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
```

```tsx
// components/locus-chat.tsx:172 — current
<AnimatePresence initial={false} mode="popLayout">
  {!isOpen ? (
    <motion.div
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 6 }}
      initial={{ opacity: 0, scale: 0.96, y: 6 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
```

Cmd/Ctrl+J is a command-palette-style, high-frequency interaction. It should
respond instantly, rather than animate a spatial relationship that does not
exist once the launcher is hidden.

## Target

Opening or closing Locus Focus is an immediate state change:

```tsx
{isOpen ? <section aria-label="Ask Locus">...</section> : null}
{!isOpen ? <Button aria-expanded={isOpen}>...</Button> : null}
```

- Do not animate the panel container, the launcher, or their layout.
- Do not use `AnimatePresence`, `layout`, `layoutId`, `mode="popLayout"`,
  `scale`, or `y` for this toggle.
- Preserve `motion.div` message entrances and the CSS `shimmer-text` loader;
  they represent new response content rather than the high-frequency command
  toggle.

## Repo conventions to follow

- Motion is imported from `motion/react` in
  `components/locus-chat.tsx`; retain it only because message rows still use
  `motion.div` at lines 96–127.
- The existing keyboard behavior in `components/locus-chat.tsx:29–40` is the
  close mechanism. Preserve Cmd/Ctrl+J toggling and Escape-to-close exactly.
- No dependency changes are needed.

## Steps

1. In `components/locus-chat.tsx`, remove the outer `AnimatePresence` around
   the `isOpen` panel branch. Change `motion.section` to a semantic `section`
   and remove its `initial`, `animate`, `exit`, and `transition` props. Keep
   its `aria-label`, class names, chat transcript, and form unchanged.
2. Remove the second `AnimatePresence` and its wrapping `motion.div` around
   the launcher. Render the existing shadcn `Button` directly only when
   `!isOpen`. Preserve its icon, label, keyboard hints, classes, and
   `onClick={() => setIsOpen(true)}` behavior.
3. Remove `AnimatePresence` from the `motion/react` import. Keep `motion` for
   message-row animation only. Do not alter the tool-loading shimmer,
   progressive blur primitive, message bubbles, or chat SDK code.

## Boundaries

- Do NOT add a replacement fade, spring, shared-layout transition, delay, or
  positional animation for this toggle.
- Do NOT change any non-toggle behavior, keyboard shortcuts, visual tokens,
  chat requests, or database tools.
- Do NOT add dependencies.
- If the current code no longer matches the excerpts above, stop and report
  the drift instead of improvising.

## Verification

- **Mechanical**: Run `npm run typecheck`; it must exit successfully.
- **Feel check**: Open and close the panel with both the pill and Cmd/Ctrl+J.
  Confirm the pill disappears immediately when the panel opens, the panel
  takes its final fixed-bottom position in the same frame, and neither moves
  upward or overlaps the other. Close with Escape and confirm the pill appears
  in its final position without an enter animation.
- **Rapid-toggle check**: Press Cmd/Ctrl+J repeatedly. There must be no stale
  exiting pill, double-exposure, or layout jump.
- **Reduced-motion check**: With `prefers-reduced-motion` enabled, behavior is
  identical because the toggle has no motion.
- **Done when**: the Focus toggle feels as immediate and stable as the command
  palette and the panel no longer glitches during open or close.
