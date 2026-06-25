import { config } from '../config';

const SLUG_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const MIN_LENGTH = 3;
const MAX_LENGTH = 63;

export function validateSlug(slug: string): string | null {
  if (!slug || slug.length < MIN_LENGTH) {
    return `Slug должен быть минимум ${MIN_LENGTH} символа`;
  }
  if (slug.length > MAX_LENGTH) {
    return `Slug должен быть максимум ${MAX_LENGTH} символов`;
  }
  if (!SLUG_REGEX.test(slug)) {
    return 'Slug может содержать только строчные буквы, цифры и дефисы';
  }
  if (slug.includes('--')) {
    return 'Slug не может содержать два дефиса подряд';
  }
  if (config.reservedSlugs.includes(slug)) {
    return 'Этот slug зарезервирован';
  }
  return null;
}
