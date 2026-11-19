import { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, Calendar, Check, Clock, MapPin, X } from 'lucide-react';
import { getPlacementCalendar, listOffers, myOffers, respondToOffer } from '../api/offers.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLES } from '../auth/roles.js';
import AppShell from '../components/AppShell.jsx';
import KpiCard from '../components/KpiCard.jsx';
import { CardSkeleton } from '../components/Skeleton.jsx';
import { formatDateTime } from '../lib/format.js';

const OFFER_TONE = {
  PENDING: 'bg-warnt text-warn',
  ACCEPTED: 'bg-okt text-ok',
  DECLINED: 'bg-badt text-bad',
};

export default function PlacementCalendar() {
  const { user } = useAuth();
  const isStudent = user?.role === ROLES.STUDENT;

  const [events, setEvents] = useState(null);
  const [offers, setOffers] = useState(null);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyOfferId, setBusyOfferId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [cal, off] = await Promise.all([
        getPlacementCalendar(),
        isStudent ? myOffers().catch(() => []) : listOffers().catch(() => []),
      ]);
      setEvents(cal || []);
      setOffers(off || []);
      setError('');
    } catch (e) {
      setError(e.message || 'Could not load placement calendar.');
      setEvents([]);
      setOffers([]);
    }
  }, [isStudent]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRespond(offer, nextStatus) {
    setBusyOfferId(offer.id);
    setNotice('');
    setError('');
    try {
      await respondToOffer(offer.id, nextStatus);
      setNotice(`Offer from ${offer.companyName} marked as ${nextStatus}.`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyOfferId(null);
    }
  }

  const filteredEvents = useMemo(() => {
    return (events || []).filter((ev) => {
      if (typeFilter === 'ALL') return true;
      return ev.type === typeFilter;
    });
  }, [events, typeFilter]);

  const stats = useMemo(() => {
    const list = events || [];
    const offerList = offers || [];
    return {
      deadlines: list.filter((e) => e.type === 'DEADLINE').length,
      rounds: list.filter((e) => e.type === 'ROUND').length,
      offers: offerList.length,
      accepted: offerList.filter((o) => o.offerStatus === 'ACCEPTED').length,
    };
  }, [events, offers]);

  return (
    <AppShell className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Placement Calendar &amp; Offers</h1>
          <p className="mt-1 text-sm text-mute">
            Upcoming application deadlines, scheduled interview rounds, and final offer status.
          </p>
        </div>

        <div role="tablist" aria-label="Filter calendar events" className="inline-flex rounded-xl border border-line bg-bg p-1">
          {[
            ['ALL', 'All Events'],
            ['DEADLINE', 'Deadlines'],
            ['ROUND', 'Rounds'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={typeFilter === key}
              onClick={() => setTypeFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                typeFilter === key ? 'bg-surf text-ink shadow-sm' : 'text-mute hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {events && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Open Deadlines" value={stats.deadlines} tone="pri" />
          <KpiCard label="Scheduled Rounds" value={stats.rounds} tone="warn" />
          <KpiCard label={isStudent ? 'My Offers' : 'Total Offers'} value={stats.offers} />
          <KpiCard label="Accepted Offers" value={stats.accepted} tone="ok" />
        </div>
      )}

      {notice && <p role="status" className="rounded-lg bg-okt p-3 text-sm text-ok">{notice}</p>}
      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-badt p-3 text-sm text-bad">
          <span>{error}</span>
          <button type="button" className="btn-ghost text-xs" onClick={load}>Retry</button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <section className="card grid gap-4 lg:col-span-7" aria-labelledby="cal-heading">
          <h2 id="cal-heading" className="text-lg font-bold">Upcoming schedule</h2>

          {events === null ? (
            <CardSkeleton count={2} />
          ) : filteredEvents.length === 0 ? (
            <p className="text-sm text-mute">No upcoming deadlines or scheduled rounds.</p>
          ) : (
            <ol className="grid gap-3">
              {filteredEvents.map((ev) => (
                <li
                  key={ev.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-bg p-3.5"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`pill ${ev.type === 'DEADLINE' ? 'bg-prit text-pri' : 'bg-warnt text-warn'}`}>
                        {ev.type === 'DEADLINE' ? 'Deadline' : 'Round'}
                      </span>
                      <span className="font-bold text-ink">{ev.companyName}</span>
                      <span className="text-sm text-mute">· {ev.title}</span>
                    </div>
                    <p className="mt-1 text-xs text-mute">{ev.driveTitle}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} aria-hidden="true" />
                        {formatDateTime(ev.startsAt)}
                      </span>
                      {ev.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={12} aria-hidden="true" />
                          {ev.location}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="card grid gap-4 lg:col-span-5" aria-labelledby="offers-heading">
          <div className="flex items-center gap-2">
            <Award size={18} className="text-pri" aria-hidden="true" />
            <h2 id="offers-heading" className="text-lg font-bold">
              {isStudent ? 'My Offers' : 'Recorded Offers'}
            </h2>
          </div>

          {offers === null ? (
            <CardSkeleton count={1} />
          ) : offers.length === 0 ? (
            <p className="text-sm text-mute">
              {isStudent
                ? 'No offers recorded yet. Offers appear here once you are selected.'
                : 'No offers recorded yet. Record offers from the Applications board on Selected candidates.'}
            </p>
          ) : (
            <ul className="grid gap-3">
              {offers.map((o) => (
                <li key={o.id} className="rounded-xl border border-line bg-bg p-3.5 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-ink">{o.companyName}</p>
                      <p className="text-xs text-mute">
                        {o.driveTitle}
                        {!isStudent && o.studentName ? ` · ${o.studentName}` : ''}
                      </p>
                    </div>
                    <span className={`pill ${OFFER_TONE[o.offerStatus] || 'bg-line text-mute'}`}>
                      {o.offerStatus}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute">
                    <span className="font-semibold text-pri">{o.offeredCtcLpa} LPA</span>
                    {o.joiningDate && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={12} aria-hidden="true" />
                        Joining: {o.joiningDate}
                      </span>
                    )}
                  </div>
                  {o.notes && <p className="mt-1.5 text-xs text-mute">{o.notes}</p>}

                  {isStudent && o.offerStatus === 'PENDING' && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        className="btn text-xs"
                        disabled={busyOfferId === o.id}
                        onClick={() => handleRespond(o, 'ACCEPTED')}
                      >
                        <Check size={13} aria-hidden="true" /> Accept
                      </button>
                      <button
                        type="button"
                        className="btn-ghost text-xs text-bad hover:border-bad"
                        disabled={busyOfferId === o.id}
                        onClick={() => handleRespond(o, 'DECLINED')}
                      >
                        <X size={13} aria-hidden="true" /> Decline
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}