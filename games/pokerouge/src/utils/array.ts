export function coerceArray<T>(input: T): T extends readonly unknown[] ? T : [T];
export function coerceArray<T>(input: T): T | [T] {
  return Array.isArray(input) ? input : [input];
}
