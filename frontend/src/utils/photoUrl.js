/**
 * Nominee profile photo URL for <img src>.
 * Uploaded photos include ?v=timestamp in the API; external URLs pass through unchanged.
 */
export function nomineePhotoSrc(photoUrl) {
  if (!photoUrl || typeof photoUrl !== 'string') return photoUrl;
  return photoUrl;
}
