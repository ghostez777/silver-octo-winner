/** Utility helpers for enum-like objects used by PokéRogue. */
export function getEnumKeys<T extends Record<string, unknown>>(enumType: T): (keyof T)[] {
  return Object.keys(enumType).filter(key => typeof enumType[key] !== "number") as (keyof T)[];
}

export function getEnumValues<T extends Record<string, unknown>>(enumType: T): T[keyof T][] {
  return Object.values(enumType).filter(value => typeof value !== "string") as T[keyof T][];
}

export function enumValueToKey<T extends Record<string, unknown>>(
  object: T,
  val: T[keyof T],
): keyof T {
  for (const [key, value] of Object.entries(object)) {
    if (value === val) return key as keyof T;
  }
  throw new Error("Invalid value passed to enumValueToKey! Value: " + String(val));
}
