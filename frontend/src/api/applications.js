import { apiRequest } from './client.js';
import { queryString } from '../lib/format.js';

export const myApplications = (params = {}, sizeArg = 20) => {
  const opts = typeof params === 'number' ? { page: params, size: sizeArg } : params;
  const { search, status, page = 0, size = 20 } = opts;
  return apiRequest(`/applications/me${queryString({ search, status, page, size })}`);
};

export const withdrawApplication = (id) =>
  apiRequest(`/applications/${id}/withdraw`, { method: 'POST' });

// Administrator and SPOC (the server limits a SPOC to their own department)
export const listApplications = ({ driveId, status, search, branch, batch, page = 0, size = 25 } = {}) =>
  apiRequest(`/applications${queryString({ driveId, status, search, branch, batch, page, size })}`);

export const setApplicationStatus = (id, status, note) =>
  apiRequest(`/admin/applications/${id}/status`, { method: 'POST', body: { status, note: note || null } });