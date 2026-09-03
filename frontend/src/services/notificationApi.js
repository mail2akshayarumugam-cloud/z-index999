import { apiGet } from './api';

export function getNotifications(user_id) {
  return apiGet(`/api/notifications/${encodeURIComponent(user_id)}`);
}

export function getHealth() {
  return apiGet('/api/health');
}
