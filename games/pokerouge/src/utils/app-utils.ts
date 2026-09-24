/** Browser capability helpers used by the client. */
export function hasTouchscreen(): boolean {
  return (
    typeof window !== "undefined" &&
    ("ontouchstart" in window || navigator.maxTouchPoints > 0)
  );
}
