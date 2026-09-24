import { globalManifest } from "#app/global-manifest";

export function getCachedUrl(url: string): string {
  const manifest = globalManifest;
  if (!manifest) return url;

  const normalizedUrl = `/${url.replace("./", "")}`;
  const timestamp = manifest[normalizedUrl];
  return timestamp ? `${url}?t=${timestamp}` : url;
}

export function cachedFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(getCachedUrl(url), init);
}
