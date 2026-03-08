export const COOKIE_CONSENT_KEY = 'vh_cookie_consent';

export type CookieConsentState = 'accepted' | 'rejected';

export function getStoredCookieConsent(): CookieConsentState | null {
  if (typeof window === 'undefined') return null;

  const value = window.localStorage.getItem(COOKIE_CONSENT_KEY);
  if (value === 'accepted' || value === 'rejected') {
    return value;
  }

  return null;
}

export function setStoredCookieConsent(value: CookieConsentState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
}
