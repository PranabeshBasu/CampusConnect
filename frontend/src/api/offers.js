import { apiRequest } from './client.js';

export const listOffers = () => apiRequest('/admin/offers');

export const upsertOffer = (applicationId, body) =>
  apiRequest(`/admin/offers/application/${applicationId}`, {
    method: 'PUT',
    body,
  });

export const myOffers = () => apiRequest('/offers/me');

export const respondToOffer = (offerId, offerStatus) =>
  apiRequest(`/offers/${offerId}/respond`, {
    method: 'PATCH',
    body: { offerStatus },
  });

export const getPlacementCalendar = () => apiRequest('/calendar');