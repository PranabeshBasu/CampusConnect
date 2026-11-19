import { apiRequest, apiBlob } from './client.js';

const BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');

async function fetchDocumentBlob(path) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: '*/*' },
  });
  if (!res.ok) {
    throw new Error(`Unable to load document (${res.status}).`);
  }
  return res.blob();
}

export const getStudentProfile = () =>
  apiRequest('/students/me');

export const saveStudentProfile = (profile) =>
  apiRequest('/students/me', {
    method: 'PUT',
    body: profile,
  });

export const uploadStudentResume = (file) => {
  const formData = new FormData();
  formData.append('file', file);

  return apiRequest('/students/me/resume', {
    method: 'POST',
    body: formData,
  });
};

export const downloadStudentResume = () =>
  apiBlob('/students/me/resume');

export const viewStudentResume = () =>
  apiBlob('/students/me/resume/view');

export const deleteStudentResume = () =>
  apiRequest('/students/me/resume', {
    method: 'DELETE',
  });

export const analyzeStudentResume = ({ jobDescription, targetRole = null, resumeText = null }) =>
  apiRequest('/students/me/resume/analyze', {
    method: 'POST',
    body: { jobDescription, targetRole, resumeText },
  });

export const listResumeAnalyses = () =>
  apiRequest('/students/me/resume/analyses');

export const deleteResumeAnalysis = (analysisId) =>
  apiRequest(`/students/me/resume/analyses/${analysisId}`, {
    method: 'DELETE',
  });

export const getStudentResumeMetadata = () =>
  apiRequest('/students/me/resume/metadata');

export const listStudentDocuments = () =>
  apiRequest('/students/me/documents');

export const uploadStudentDocument = (docType, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest(`/students/me/documents/${encodeURIComponent(docType)}`, {
    method: 'POST',
    body: formData,
  });
};

export const viewStudentDocument = (docType) =>
  fetchDocumentBlob(`/students/me/documents/${encodeURIComponent(docType)}/file`);

export const deleteStudentDocument = (docType) =>
  apiRequest(`/students/me/documents/${encodeURIComponent(docType)}`, {
    method: 'DELETE',
  });

export const listStudentDocumentsForStaff = (userId) =>
  apiRequest(`/spoc/students/${userId}/documents`);

export const viewStudentDocumentForStaff = (userId, docType) =>
  fetchDocumentBlob(`/spoc/students/${userId}/documents/${encodeURIComponent(docType)}/file`);