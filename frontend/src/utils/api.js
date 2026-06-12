import { API_BASE_URL } from '../config';

export async function authFetch(url, options = {}, onUnauthorized) {
  const res = await fetch(url.startsWith('http') ? url : `${API_BASE_URL}${url}`, options);
  if ((res.status === 401 || res.status === 403) && onUnauthorized) {
    onUnauthorized();
  }
  return res;
}
