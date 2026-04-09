import { API_ORIGIN } from '../services/api';

export const resolveServiceImageUrl = (imageUrl, fallbackImage = '') => {
  if (typeof imageUrl !== 'string' || imageUrl.trim() === '') {
    return fallbackImage;
  }

  const trimmedImageUrl = imageUrl.trim();

  if (
    trimmedImageUrl.startsWith('http://') ||
    trimmedImageUrl.startsWith('https://') ||
    trimmedImageUrl.startsWith('data:') ||
    trimmedImageUrl.startsWith('blob:')
  ) {
    return trimmedImageUrl;
  }

  if (trimmedImageUrl.startsWith('/')) {
    return `${API_ORIGIN}${trimmedImageUrl}`;
  }

  return `${API_ORIGIN}/${trimmedImageUrl.replace(/^\/+/, '')}`;
};