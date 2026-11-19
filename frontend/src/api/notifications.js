import { apiRequest } from './client.js';

export const listNotifications = () => apiRequest('/notifications');
export const markNotificationRead = (id) =>
  apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });
export const markAllNotificationsRead = () =>
  apiRequest('/notifications/read-all', { method: 'POST' });