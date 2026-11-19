import { apiRequest } from './client.js';

export const listCompanies = () => apiRequest('/admin/companies');

export const createCompany = (body) =>
  apiRequest('/admin/companies', { method: 'POST', body });

export const updateCompany = (id, body) =>
  apiRequest(`/admin/companies/${id}`, { method: 'PUT', body });

export const setCompanyActive = (id, active) =>
  apiRequest(`/admin/companies/${id}/active`, { method: 'PATCH', body: { active } });

export const importCompaniesCsv = (file) => {
  const form = new FormData();
  form.append('file', file);
  return apiRequest('/admin/companies/import', { method: 'POST', body: form });
};