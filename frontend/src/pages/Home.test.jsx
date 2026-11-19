import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/AuthContext.jsx';
import * as drivesApi from '../api/drives.js';
import Home from './Home.jsx';

vi.mock('../api/drives.js');

function renderHome(auth = { status: 'unauthenticated', user: null }) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('Home', () => {
  beforeEach(() => {
    drivesApi.listPublicDrives.mockResolvedValue({
      items: [{ id: 1, companyName: 'Cognizant', title: 'Software Engineer', ctcLpa: 8, graduationYear: 2027 }],
    });
    drivesApi.getPublicStats.mockResolvedValue({ activeDrives: 42, registeredCompanies: 120, eligibleStudents: 1850 });
  });

  it('shows the placement snapshot instead of the system status card', async () => {
    renderHome();
    expect(screen.getByRole('heading', { name: 'Placement Snapshot' })).toBeInTheDocument();
    expect(screen.queryByText('System status')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('1850')).toBeInTheDocument());
    expect(screen.getByText('Eligible Students')).toBeInTheDocument();
    expect(screen.getByText('Participating Companies')).toBeInTheDocument();
  });

  it('lists open drives with a View all drives link', async () => {
    renderHome();
    expect(await screen.findByText('Cognizant')).toBeInTheDocument();
    expect(screen.getByText(/Software Engineer • 8 LPA • Batch 2027/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View all drives/ })).toHaveAttribute('href', '/signin');
  });

  it('does not show Planned badges on the role cards', () => {
    renderHome();
    expect(screen.queryByText('Planned')).not.toBeInTheDocument();
  });

  it('points a signed-in student to their drives page', async () => {
    renderHome({ status: 'authenticated', user: { role: 'STUDENT', fullName: 'A', email: 'a@x.com' } });
    expect(await screen.findByRole('link', { name: /View all drives/ })).toHaveAttribute('href', '/student/drives');
  });

  it('shows an empty state when no drives are open', async () => {
    drivesApi.listPublicDrives.mockResolvedValue({ items: [] });
    renderHome();
    expect(await screen.findByText('No placement drives are currently open.')).toBeInTheDocument();
  });
});