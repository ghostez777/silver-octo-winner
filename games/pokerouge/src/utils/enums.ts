/** Utility helpers for enum-like objects. */
export function enumValueToKey<T extends Record<string, unknown>>(object: T, val: T[keyof T]): keyof T {
  for (const [key, value] of Object.entries(object)) {
    if (value === val) return key as keyof T;
  }
  throw new Error("Invalid value passed to enumValueToKey! Value: " + String(val));
}
