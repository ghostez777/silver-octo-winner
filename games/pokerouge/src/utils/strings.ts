/**
 * String helpers used by the PokéRogue client.
 */
function splitWords(value: string): string[] {
  return value
    .trim()
    .replace(/([\p{Ll}\d])([\p{Lu}])/gu, "$1\0$2")
    .replace(/([\p{Lu}])([\p{Lu}][\p{Ll}])/gu, "$1\0$2")
    .replace(/[-_ ]+/gu, "\0")
    .replace(/^\0+|\0+$/gu, "")
    .split("\0")
    .filter(Boolean);
}

export function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function capitalizeFirstLetterOnly(str: string): string {
  return capitalizeFirstLetter(str.toLowerCase());
}

export function toCamelCase(str: string): string {
  return splitWords(str)
    .map((word, index) =>
      index === 0 ? word.toLowerCase() : capitalizeFirstLetterOnly(word),
    )
    .join("");
}

export function toKebabCase(str: string): string {
  return splitWords(str)
    .map(word => word.toLowerCase())
    .join("-");
}
