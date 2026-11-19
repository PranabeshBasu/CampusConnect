import { apiRequest } from './client.js';
import { queryString } from '../lib/format.js';

export const listDepartmentStudents = (
  departmentId,
  { search, verified, page = 0, size = 25 } = {},
) =>
  apiRequest(
    `/departments/${departmentId}/students${queryString({
      search,
      verified: verified === '' || verified === undefined ? undefined : verified,
      page,
      size,
    })}`,
  );

export const verifyStudentProfile = (
  departmentId,
  studentUserId,
  { verified, note = '' },
) =>
  apiRequest(`/departments/${departmentId}/students/${studentUserId}/verify`, {
    method: 'PATCH',
    body: { verified, note: note?.trim() || null },
  });