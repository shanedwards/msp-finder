export function normalizeCompanyName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

export function formatGeography(
  city: string | null,
  state: string | null,
): string | null {
  const trimmedCity = city?.trim() ?? "";
  const trimmedState = state?.trim() ?? "";

  if (!trimmedCity && !trimmedState) {
    return null;
  }

  if (!trimmedCity) {
    return trimmedState;
  }

  if (!trimmedState) {
    return trimmedCity;
  }

  return `${trimmedCity}, ${trimmedState}`;
}

export function formatEmployeeCount(
  exact: number | null,
  min: number | null,
  max: number | null,
): string {
  if (typeof exact === "number" && Number.isFinite(exact)) {
    return `${Math.trunc(exact)}`;
  }

  if (
    typeof min === "number" &&
    Number.isFinite(min) &&
    typeof max === "number" &&
    Number.isFinite(max)
  ) {
    return `${Math.trunc(min)}-${Math.trunc(max)}`;
  }

  if (typeof min === "number" && Number.isFinite(min)) {
    return `${Math.trunc(min)}+`;
  }

  return "Unknown";
}

export function getWebsiteDomain(website: string | null): string | null {
  if (!website) {
    return null;
  }

  try {
    const url = new URL(website);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function isLikelyRealWebsite(website: string | null): boolean {
  const domain = getWebsiteDomain(website);
  if (!domain) {
    return false;
  }

  // Catch obvious non-company placeholders.
  const blocked = ["example.com", "localhost", "facebook.com", "x.com"];
  return !blocked.some((item) => domain === item || domain.endsWith(`.${item}`));
}
