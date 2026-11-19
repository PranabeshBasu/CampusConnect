import { useEffect, useState } from 'react';
import { Calendar, MapPin, Plus } from 'lucide-react';
import {
  assignApplicationToRound,
  createDriveRound,
  listDriveRounds,
  listRoundParticipants,
  updateRoundParticipantOutcome,
} from '../api/rounds.js';
import { listApplications } from '../api/applications.js';
import { formatDateTime } from '../lib/format.js';

const OUTCOMES = ['PENDING', 'PASSED', 'FAILED', 'ABSENT'];

const OUTCOME_TONE = {
  PASSED: 'bg-okt text-ok',
  FAILED: 'bg-badt text-bad',
  ABSENT: 'bg-badt text-bad',
  PENDING: 'bg-warnt text-warn',
};

export default function DriveRounds({ drive }) {
  const [rounds, setRounds] = useState([]);
  const [applications, setApplications] = useState([]);
  const [participants, setParticipants] = useState({});
  const [selectedRound, setSelectedRound] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    sequenceNumber: '',
    scheduledAt: '',
    venue: '',
    instructions: '',
  });
  const [assignments, setAssignments] = useState({});
  const [feedback, setFeedback] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadRounds() {
    try {
      const data = await listDriveRounds(drive.id);
      setRounds(data);
      if (data.length && !selectedRound) {
        setSelectedRound(String(data[0].id));
      } else if (data.length === 0) {
        setShowCreateForm(true);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadApplications() {
    try {
      const data = await listApplications({ driveId: drive.id, size: 100 });
      setApplications(data.items || []);
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadParticipants(roundId) {
    if (!roundId) return;
    try {
      const data = await listRoundParticipants(roundId);
      setParticipants((old) => ({ ...old, [roundId]: data }));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    setSelectedRound('');
    loadRounds();
    loadApplications();
  }, [drive.id]);

  useEffect(() => {
    loadParticipants(selectedRound);
  }, [selectedRound]);

  async function createRound(e) {
    e.preventDefault();
    setError('');
    setNotice('');

    if (!form.name.trim() || Number(form.sequenceNumber) <= 0) {
      setError('Enter a round name and a positive sequence number.');
      return;
    }

    setLoading(true);
    try {
      const created = await createDriveRound(drive.id, {
        name: form.name.trim(),
        sequenceNumber: Number(form.sequenceNumber),
        scheduledAt: form.scheduledAt
          ? new Date(form.scheduledAt).toISOString()
          : null,
        venue: form.venue.trim() || null,
        instructions: form.instructions.trim() || null,
      });

      setForm({
        name: '',
        sequenceNumber: '',
        scheduledAt: '',
        venue: '',
        instructions: '',
      });
      setShowCreateForm(false);
      setNotice('Recruitment round created.');
      await loadRounds();
      if (created?.id) setSelectedRound(String(created.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function assign(roundId) {
    const applicationId = assignments[roundId];
    if (!applicationId) {
      setError('Choose an application first.');
      return;
    }

    setError('');
    setNotice('');
    try {
      await assignApplicationToRound(roundId, Number(applicationId));
      setNotice('Application assigned to the round.');
      setAssignments((old) => ({ ...old, [roundId]: '' }));
      await loadParticipants(roundId);
    } catch (e) {
      setError(e.message);
    }
  }

  async function saveOutcome(roundId, participant) {
    const outcome = participant.outcome;
    try {
      await updateRoundParticipantOutcome(
        roundId,
        participant.id,
        outcome,
        feedback[participant.id] || null
      );
      setNotice('Round outcome saved.');
      await loadParticipants(roundId);
    } catch (e) {
      setError(e.message);
    }
  }

  const currentParticipants = participants[selectedRound] || [];
  const assignedIds = currentParticipants.map((p) => p.applicationId);

  return (
    <section className="mt-6 rounded-2xl border border-line bg-bg p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <h3 className="text-lg font-bold">
            Recruitment rounds · {drive.companyName}
          </h3>
          <p className="text-xs text-mute">{drive.title}</p>
        </div>
        <button
          type="button"
          className="btn-ghost text-xs"
          onClick={() => setShowCreateForm((v) => !v)}
        >
          <Plus size={14} aria-hidden="true" />
          {showCreateForm ? 'Hide new round form' : 'New round'}
        </button>
      </div>

      {notice && <p role="status" className="mt-3 rounded-lg bg-okt p-2.5 text-sm text-ok">{notice}</p>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-badt p-2.5 text-sm text-bad">{error}</p>}

      {showCreateForm && (
        <form onSubmit={createRound} className="mt-4 grid gap-3 rounded-xl border border-line bg-surf p-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium">
            Round name
            <input
              className="rounded-lg border border-line bg-bg px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Technical Interview"
              required
            />
          </label>

          <label className="grid gap-1 text-sm font-medium">
            Round number
            <input
              type="number"
              min="1"
              className="rounded-lg border border-line bg-bg px-3 py-2 text-sm"
              value={form.sequenceNumber}
              onChange={(e) => setForm({ ...form, sequenceNumber: e.target.value })}
              required
            />
          </label>

          <label className="grid gap-1 text-sm font-medium">
            Scheduled date and time
            <input
              type="datetime-local"
              className="rounded-lg border border-line bg-bg px-3 py-2 text-sm"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
            />
          </label>

          <label className="grid gap-1 text-sm font-medium">
            Venue
            <input
              className="rounded-lg border border-line bg-bg px-3 py-2 text-sm"
              value={form.venue}
              onChange={(e) => setForm({ ...form, venue: e.target.value })}
              placeholder="Auditorium / Zoom Link"
            />
          </label>

          <label className="grid gap-1 text-sm font-medium sm:col-span-2">
            Instructions
            <textarea
              className="rounded-lg border border-line bg-bg px-3 py-2 text-sm"
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            />
          </label>

          <div className="flex justify-end gap-2 sm:col-span-2">
            {rounds.length > 0 && (
              <button type="button" className="btn-ghost text-xs" onClick={() => setShowCreateForm(false)}>
                Cancel
              </button>
            )}
            <button className="btn" type="submit" disabled={loading}>
              {loading ? 'Creating…' : 'Create round'}
            </button>
          </div>
        </form>
      )}

      {rounds.length === 0 ? (
        <p className="mt-4 text-sm text-mute">No recruitment rounds created yet.</p>
      ) : (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Recruitment rounds">
            {rounds.map((r) => {
              const active = String(r.id) === selectedRound;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedRound(String(r.id))}
                  className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
                    active
                      ? 'border-pri bg-prit text-pri'
                      : 'border-line bg-surf text-mute hover:text-ink'
                  }`}
                >
                  Round {r.sequenceNumber}: {r.name}
                </button>
              );
            })}
          </div>

          {rounds
            .filter((r) => String(r.id) === selectedRound)
            .map((r) => (
              <div key={r.id} className="mt-3 rounded-xl border border-line bg-surf p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-ink">{r.name}</p>
                  <span className="pill bg-prit text-pri">{r.status}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute">
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={12} aria-hidden="true" />
                    {r.scheduledAt ? formatDateTime(r.scheduledAt) : 'Not scheduled'}
                  </span>
                  {r.venue && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} aria-hidden="true" />
                      {r.venue}
                    </span>
                  )}
                </div>
                {r.instructions && <p className="mt-2 text-xs text-ink">{r.instructions}</p>}
              </div>
            ))}

          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
            <select
              aria-label="Choose an application to assign"
              className="rounded-lg border border-line bg-surf px-3 py-2 text-sm text-ink"
              value={assignments[selectedRound] || ''}
              onChange={(e) =>
                setAssignments((old) => ({ ...old, [selectedRound]: e.target.value }))
              }
            >
              <option value="">Choose an application</option>
              {applications
                .filter((a) => !assignedIds.includes(a.id))
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.studentName} · {a.studentEmail} ({a.status})
                  </option>
                ))}
            </select>
            <button type="button" className="btn" onClick={() => assign(selectedRound)}>
              Assign application
            </button>
          </div>

          <h4 className="mt-5 text-sm font-bold uppercase tracking-wider text-mute">
            Assigned applicants ({currentParticipants.length})
          </h4>
          {currentParticipants.length === 0 && (
            <p className="mt-2 text-sm text-mute">No applicants assigned to this round.</p>
          )}

          {currentParticipants.map((p) => {
            const app = applications.find((a) => a.id === p.applicationId);
            return (
              <div key={p.id} className="mt-2 grid gap-3 rounded-xl border border-line bg-surf p-4 sm:grid-cols-3 sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-ink">{app?.studentName || `Application ${p.applicationId}`}</p>
                    <span className={`pill ${OUTCOME_TONE[p.outcome] || 'bg-line text-mute'}`}>
                      {p.outcome}
                    </span>
                  </div>
                  <p className="text-xs text-mute">{app?.studentEmail || ''}</p>
                </div>

                <select
                  aria-label={`Outcome for ${app?.studentName || p.applicationId}`}
                  className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink"
                  value={p.outcome}
                  onChange={(e) =>
                    setParticipants((old) => ({
                      ...old,
                      [selectedRound]: old[selectedRound].map((item) =>
                        item.id === p.id ? { ...item, outcome: e.target.value } : item
                      ),
                    }))
                  }
                >
                  {OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>

                <button type="button" className="btn justify-center" onClick={() => saveOutcome(selectedRound, p)}>
                  Save outcome
                </button>

                <textarea
                  className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink sm:col-span-3"
                  placeholder="Feedback (optional)"
                  value={feedback[p.id] ?? p.feedback ?? ''}
                  onChange={(e) => setFeedback((old) => ({ ...old, [p.id]: e.target.value }))}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}