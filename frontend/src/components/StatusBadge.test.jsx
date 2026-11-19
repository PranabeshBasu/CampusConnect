import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatusBadge from './StatusBadge.jsx';

describe('StatusBadge', () => {
  it.each(['OPEN', 'SHORTLISTED', 'SELECTED', 'CLOSED', 'WITHDRAWN', 'CANCELLED'])('renders %s', (s) => {
    render(<StatusBadge status={s} />);
    expect(screen.getByText(s)).toBeInTheDocument();
  });

  it('uses the danger tone for withdrawn and the success tone for open', () => {
    const { rerender } = render(<StatusBadge status="WITHDRAWN" />);
    expect(screen.getByText('WITHDRAWN').className).toContain('text-bad');
    rerender(<StatusBadge status="OPEN" />);
    expect(screen.getByText('OPEN').className).toContain('text-ok');
  });
});