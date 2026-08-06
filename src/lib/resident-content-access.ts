import { NewsVisibility } from "@prisma/client";

/** URL parameters never decide what an unbound resident may read. */
export function residentContentVisibility(hasResidentAccess: boolean): NewsVisibility | { in: NewsVisibility[] } {
  return hasResidentAccess ? { in: [NewsVisibility.PUBLIC, NewsVisibility.RESIDENT_ONLY] } : NewsVisibility.PUBLIC;
}

export function residentAlbumWhere(hasResidentAccess: boolean): { isPublic?: boolean } {
  return hasResidentAccess ? {} : { isPublic: true };
}
