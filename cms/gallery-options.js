export const heroCategory = "f36e184c-5c9c-4a1e-a48d-fef40cde801e";

export function photoLink(value) {
  if (!value || !/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    return url.hostname && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
