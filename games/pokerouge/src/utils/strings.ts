/**
 * Minimal string helpers required by the Vite i18n build plugin.
 */
function splitWords(value: string): string[] {
  return value
    .trim()
    .replace(/([\\p{Ll}\\d])([\\p{Lu}])/gu, "$1\\0$2")
    .replace(/([\\p{Lu}])([\\p{Lu}][\\p{Ll}])/gu, "$1\\0$2")
    .replace(/[-_ ]+/gu, "\\0")
    .replace(/^\\0+|\\0+$/gu, "")
    .split("\\0")
    .filter(Boolean);
}

export function toCamelCase(str: string): string {
  return splitWords(str)
    .map((word, index) =>
      index === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join("");
}
