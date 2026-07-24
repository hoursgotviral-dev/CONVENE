// Shared API client that always sends credentials and handles 403 errors
import { API_BASE } from './config';

type ApiErrorHandler = (message: string) => void;

let on403: ApiErrorHandler | null = null;

export const setOn403Handler = (handler: ApiErrorHandler) => {
  on403 = handler;
};

export const apiFetch = async (url: string, options?: RequestInit): Promise<Response> => {
  const fullUrl = url.startsWith('/api') ? `${API_BASE}${url}` : url;
  const response = await fetch(fullUrl, {
    ...options,
    credentials: 'include',
  });

  if (response.status === 403 && on403) {
    on403("You've lost access to this room — rejoin with the room code");
  }

  return response;
};
