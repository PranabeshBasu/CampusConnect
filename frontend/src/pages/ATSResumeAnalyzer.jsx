import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { CheckCircle2, Clock, FileText, Sparkles, Trash2, Upload } from 'lucide-react';
import { listOpenDrives } from '../api/drives.js';
import {
  analyzeStudentResume,
  deleteResumeAnalysis,
  downloadStudentResume,
  listResumeAnalyses,
} from '../api/studentProfile.js';
import AppShell from '../components/AppShell.jsx';
import { formatDateTime } from '../lib/format.js';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const DOMAINS = [
  'Auto Detect',
  'CSE',
  'CSE (AI & ML)',
  'CSIT',
  'Information Technology',
  'Data Science',
  'Cybersecurity',
  'ECE',
  'EEE',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'MBA / Business Analytics',
  'Finance',
  'Marketing',
  'Human Resources',
  'Other',
];

async function extractPdfText(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  let text = '';
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    text += `${content.items.map((item) => item.str).join(' ')} `;
  }

  return text.trim();
}

function downloadReport(result, filename) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 13;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  const colors = {
    navy: [24, 35, 65],
    blue: [59, 103, 210],
    green: [22, 150, 100],
    red: [210, 75, 75],
    gray: [100, 110, 125],
    light: [243, 246, 250],
    dark: [35, 42, 55],
    white: [255, 255, 255],
  };

  function checkPage(heightNeeded = 12) {
    if (y + heightNeeded > pageHeight - 17) {
      doc.addPage();
      y = 16;
    }
  }

  function addWrappedText(text, fontSize = 10, color = colors.dark, options = {}) {
    const { bold = false, indent = 0, spacing = 2 } = options;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);

    const lines = doc.splitTextToSize(String(text || ''), contentWidth - indent);
    const lineHeight = fontSize * 0.42 + 1.5;
    checkPage(lines.length * lineHeight + spacing);
    doc.text(lines, margin + indent, y);
    y += lines.length * lineHeight + spacing;
  }

  function addSectionTitle(title, color = colors.navy) {
    checkPage(14);
    doc.setFillColor(...colors.light);
    doc.roundedRect(margin, y - 4, contentWidth, 9, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...color);
    doc.text(title, margin + 3, y + 1.5);
    y += 11;
  }

  doc.setFillColor(...colors.navy);
  doc.rect(0, 0, pageWidth, 38, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(...colors.white);
  doc.text('CampusConnect', margin, 17);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(220, 230, 245);
  doc.text('AI Resume Analysis Report', margin, 26);
  doc.setFontSize(7);
  doc.text(result.aiPowered ? 'Powered by Gemini AI' : 'Semantic & Structure Analysis', margin, 32);
  y = 45;

  addWrappedText(`Target Role / Domain: ${result.targetRole || 'General'}`, 10, colors.dark, { bold: true, spacing: 1 });
  addWrappedText(`Resume: ${result.resumeFileName || filename}`, 9, colors.gray, { spacing: 1 });
  addWrappedText(`Generated: ${new Date().toLocaleString()}`, 9, colors.gray, { spacing: 4 });

  checkPage(36);
  doc.setFillColor(...colors.light);
  doc.roundedRect(margin, y, contentWidth, 27, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...colors.navy);
  doc.text('OVERALL ATS READINESS SCORE', margin + 5, y + 8);

  const scoreColor = result.score >= 70 ? colors.green : result.score >= 45 ? colors.blue : colors.red;
  doc.setFontSize(22);
  doc.setTextColor(...scoreColor);
  doc.text(`${result.score}%`, margin + 5, y + 19);

  if (result.sectionScores) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...colors.gray);
    doc.text(
      `Skills: ${result.sectionScores.skills}%  |  Projects: ${result.sectionScores.projects}%  |  Impact: ${result.sectionScores.impact}%  |  Clarity: ${result.sectionScores.clarity}%`,
      margin + 32,
      y + 18,
    );
  }
  y += 32;

  if (result.summary) {
    addWrappedText(result.summary, 9, colors.dark, { spacing: 4 });
  }

  addSectionTitle('MATCHED SKILLS', colors.green);
  addWrappedText(
    result.matchedKeywords?.length ? result.matchedKeywords.join('  |  ') : 'None identified.',
    9,
    colors.green,
    { spacing: 3 },
  );

  addSectionTitle('MISSING / GAP SKILLS', colors.red);
  addWrappedText(
    result.missingKeywords?.length ? result.missingKeywords.join('  |  ') : 'No major skill gaps identified.',
    9,
    colors.red,
    { spacing: 3 },
  );

  addSectionTitle('ACTIONABLE REWRITE SUGGESTIONS');
  (result.suggestions || []).forEach((s, index) => {
    addWrappedText(`${index + 1}. [${s.priority || 'MEDIUM'}] ${s.section || 'General'}: ${s.advice}`, 9, colors.dark, {
      bold: true,
      indent: 2,
      spacing: 1,
    });
    if (s.exampleRewrite) {
      addWrappedText(`Example: "${s.exampleRewrite}"`, 8.5, colors.gray, { indent: 5, spacing: 3 });
    }
  });

  addWrappedText(
    result.disclaimer || 'Advisory guidance only; add skills only when they genuinely reflect your experience.',
    8,
    colors.gray,
    { spacing: 3 },
  );

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(220, 225, 235);
    doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...colors.gray);
    doc.text('CampusConnect | AI Resume Analyzer', margin, pageHeight - 8);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  doc.save('CampusConnect-AI-ATS-Report.pdf');
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-5 animate-pulse" role="status" aria-label="Analyzing resume">
      <div className="card flex items-center gap-5">
        <div className="h-28 w-28 shrink-0 rounded-full bg-line" />
        <div className="flex-1 space-y-2.5">
          <div className="h-5 w-48 rounded bg-line" />
          <div className="h-4 w-64 rounded bg-line" />
          <div className="h-3 w-40 rounded bg-line" />
        </div>
      </div>
      <div className="card space-y-3">
        <div className="h-5 w-40 rounded bg-line" />
        <div className="h-3 w-full rounded bg-line" />
        <div className="h-3 w-5/6 rounded bg-line" />
      </div>
    </div>
  );
}

export default function ATSResumeAnalyzer() {
  const location = useLocation();
  const preloadedRef = useRef(false);

  const [resumeSource, setResumeSource] = useState(
    location.state?.preloadSavedResume ? 'saved' : 'upload',
  );
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [domain, setDomain] = useState('Auto Detect');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [liveDrives, setLiveDrives] = useState([]);
  const [selectedDriveId, setSelectedDriveId] = useState('');

  const refreshHistory = useCallback(() => {
    listResumeAnalyses()
      .then((list) => setHistory(Array.isArray(list) ? list : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    listOpenDrives({ page: 0, size: 50 })
      .then((res) => {
        if (alive) setLiveDrives(res?.items || []);
      })
      .catch(() => {});
    refreshHistory();
    return () => {
      alive = false;
    };
  }, [refreshHistory]);

  const loadSavedResume = useCallback(async (preferredName) => {
    setError('');
    setNotice('');
    setLoading(true);

    try {
      const blob = await downloadStudentResume();
      const file = new File([blob], preferredName || 'CampusConnect-resume.pdf', {
        type: 'application/pdf',
      });

      const text = await extractPdfText(file);
      if (!text) {
        throw new Error('No readable text found in your saved resume.');
      }

      setResumeFile(file);
      setResumeText(text);
      setNotice('Your saved CampusConnect resume has been loaded.');
    } catch (e) {
      setError(e.message || 'Could not load your saved resume.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (location.state?.preloadSavedResume && !preloadedRef.current) {
      preloadedRef.current = true;
      setResumeSource('saved');
      loadSavedResume(location.state?.fileName);
    }
  }, [location.state, loadSavedResume]);

  const selectedDrive = liveDrives.find((v) => String(v.drive.id) === selectedDriveId)?.drive || null;

  function handleDriveSelect(id) {
    setSelectedDriveId(id);
    setError('');
    if (!id) return;
    const item = liveDrives.find((v) => String(v.drive.id) === id);
    if (!item) return;
    const d = item.drive;
    const lines = [
      `Company: ${d.companyName}`,
      `Role: ${d.title}`,
      d.location ? `Location: ${d.location}` : null,
      d.ctcLpa != null ? `CTC: ${d.ctcLpa} LPA` : null,
      `Batch: ${d.graduationYear}`,
      d.minCgpa != null ? `Minimum CGPA: ${d.minCgpa}+` : null,
      d.maxActiveBacklogs != null ? `Max Active Backlogs: ${d.maxActiveBacklogs}` : null,
      d.branches?.length ? `Eligible Branches: ${d.branches.join(', ')}` : 'Eligible Branches: All branches',
      d.description ? `\nJob Description:\n${d.description}` : null,
    ].filter(Boolean);
    setJobDescription(lines.join('\n'));
    setNotice(`Loaded live placement details for ${d.companyName} — ${d.title}.`);
  }

  async function handleResumeChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setNotice('');

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF resume.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Resume must be smaller than 5 MB.');
      return;
    }

    setLoading(true);
    try {
      const text = await extractPdfText(file);
      if (!text) {
        throw new Error('No readable text found. This PDF may be scanned.');
      }
      setResumeFile(file);
      setResumeText(text);
      setNotice(`Resume loaded: ${file.name}`);
    } catch (e) {
      setError(e.message || 'Could not read this PDF.');
    } finally {
      setLoading(false);
    }
  }

  function handleSourceSwitch(source) {
    setResumeSource(source);
    if (source === 'saved') {
      loadSavedResume();
    }
  }

  async function handleAnalyze() {
    setError('');
    if (!resumeText && resumeSource !== 'saved') {
      setError('Please upload or load your resume first.');
      return;
    }
    if (jobDescription.trim().length < 25) {
      setError('Please paste a job description or select a live drive (at least 25 characters).');
      return;
    }

    const targetRole = selectedDrive
      ? `${selectedDrive.companyName} — ${selectedDrive.title}`
      : domain === 'Auto Detect'
        ? null
        : domain;

    setAnalyzing(true);
    try {
      const data = await analyzeStudentResume({
        jobDescription: jobDescription.trim(),
        targetRole,
        resumeText: resumeText || null,
      });
      setResult(data);
      setNotice(
        data.aiPowered
          ? 'AI resume analysis complete and saved to your history.'
          : 'Semantic resume analysis complete and saved to your history.',
      );
      refreshHistory();
    } catch (e) {
      setError(e.message || 'Could not analyze resume.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleDeleteHistory(id) {
    try {
      await deleteResumeAnalysis(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
      if (result?.id === id) setResult(null);
    } catch (e) {
      setError(e.message || 'Could not delete scan record.');
    }
  }

  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = result ? circumference - (result.score / 100) * circumference : circumference;
  const ringStroke = !result
    ? 'var(--pri)'
    : result.score >= 70
      ? 'var(--ok)'
      : result.score >= 45
        ? 'var(--pri)'
        : 'var(--bad)';
  const scoreTextClass = !result
    ? 'text-pri'
    : result.score >= 70
      ? 'text-ok'
      : result.score >= 45
        ? 'text-pri'
        : 'text-bad';

  const sectionList = result?.sectionScores
    ? [
        ['Skills Match', result.sectionScores.skills],
        ['Projects Depth', result.sectionScores.projects],
        ['Quantified Impact', result.sectionScores.impact],
        ['Clarity & Structure', result.sectionScores.clarity],
      ]
    : [];

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold">AI Resume Analyzer</h1>
        <p className="mt-1 text-sm text-mute">
          Get semantic skill-gap analysis, section scores, and tailored bullet rewrites against live drives or custom JDs.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="grid gap-5 lg:col-span-5">
          <section className="card grid gap-3">
            <h2 className="text-base font-bold">1. Target domain / role</h2>
            <select
              aria-label="Select your domain"
              className="w-full rounded-lg border border-line bg-bg p-2.5 text-sm text-ink"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
            >
              {DOMAINS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </section>

          <section className="card grid gap-3">
            <h2 className="text-base font-bold">2. Resume source</h2>
            <div
              role="tablist"
              aria-label="Resume source"
              className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-bg p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={resumeSource === 'upload'}
                onClick={() => handleSourceSwitch('upload')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  resumeSource === 'upload'
                    ? 'bg-surf text-ink shadow-sm'
                    : 'text-mute hover:text-ink'
                }`}
              >
                <Upload size={13} aria-hidden="true" />
                Upload PDF
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={resumeSource === 'saved'}
                onClick={() => handleSourceSwitch('saved')}
                disabled={loading}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  resumeSource === 'saved'
                    ? 'bg-surf text-ink shadow-sm'
                    : 'text-mute hover:text-ink'
                }`}
              >
                <FileText size={13} aria-hidden="true" />
                Saved resume
              </button>
            </div>

            {resumeSource === 'upload' ? (
              <div className="flex flex-wrap items-center gap-2">
                <label className="btn cursor-pointer text-sm">
                  Choose PDF
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    onChange={handleResumeChange}
                  />
                </label>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-bg p-3 text-xs">
                <span className="text-mute">
                  {loading ? 'Loading saved resume…' : 'Using your saved CampusConnect resume'}
                </span>
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={() => loadSavedResume()}
                  disabled={loading}
                >
                  Reload saved
                </button>
              </div>
            )}

            {resumeFile && (
              <p className="inline-flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2 text-xs font-medium text-ink">
                <CheckCircle2 size={14} className="shrink-0 text-ok" aria-hidden="true" />
                <span className="truncate">Selected: {resumeFile.name}</span>
              </p>
            )}
          </section>

          <section className="card grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold">3. Job description</h2>
              {selectedDriveId && (
                <button
                  type="button"
                  className="text-xs font-semibold text-pri hover:underline"
                  onClick={() => {
                    setSelectedDriveId('');
                    setJobDescription('');
                    setNotice('');
                  }}
                >
                  Clear &amp; paste custom JD
                </button>
              )}
            </div>

            {liveDrives.length > 0 && (
              <div>
                <label htmlFor="live-drive-select" className="mb-1 block text-xs font-semibold text-mute">
                  Fetch from a live placement drive (or paste any JD below)
                </label>
                <select
                  id="live-drive-select"
                  className="w-full rounded-lg border border-line bg-bg p-2.5 text-sm text-ink"
                  value={selectedDriveId}
                  onChange={(e) => handleDriveSelect(e.target.value)}
                >
                  <option value="">— Paste custom JD manually —</option>
                  {liveDrives.map((v) => (
                    <option key={v.drive.id} value={String(v.drive.id)}>
                      {v.drive.companyName} — {v.drive.title}
                      {v.drive.ctcLpa != null ? ` (${v.drive.ctcLpa} LPA)` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <textarea
              className="min-h-40 w-full rounded-lg border border-line bg-bg p-3 text-sm text-ink placeholder:text-mute"
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              placeholder="Paste the complete job description here, or select a live placement drive above..."
            />

            <button
              type="button"
              className="btn w-full justify-center"
              onClick={handleAnalyze}
              disabled={loading || analyzing}
            >
              <Sparkles size={15} aria-hidden="true" />
              {analyzing ? 'Analyzing with AI…' : 'Analyze Resume'}
            </button>
          </section>

          {history.length > 0 && (
            <section className="card grid gap-3">
              <h2 className="flex items-center gap-2 text-base font-bold">
                <Clock size={16} className="text-pri" aria-hidden="true" />
                Recent Scan History
              </h2>
              <ul className="grid gap-2">
                {history.map((item) => (
                  <li
                    key={item.id}
                    className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-xs transition ${
                      result?.id === item.id ? 'border-pri bg-prit' : 'border-line bg-bg'
                    }`}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setResult(item)}
                    >
                      <div className="truncate font-bold text-ink">
                        {item.targetRole || item.resumeFileName || 'Resume Scan'} · {item.score}%
                      </div>
                      <div className="text-[11px] text-mute">
                        {formatDateTime(item.createdAt)} · {item.aiPowered ? 'Gemini AI' : 'Local'}
                      </div>
                    </button>
                    <button
                      type="button"
                      aria-label="Delete scan"
                      className="rounded-lg p-1.5 text-mute hover:bg-badt hover:text-bad"
                      onClick={() => handleDeleteHistory(item.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {notice && <p role="status" className="rounded-lg bg-okt p-3 text-sm text-ok">{notice}</p>}
          {error && <p role="alert" className="rounded-lg bg-badt p-3 text-sm text-bad">{error}</p>}
        </div>

        <div className="grid gap-5 lg:sticky lg:top-20 lg:col-span-7">
          {loading || analyzing ? (
            <ResultsSkeleton />
          ) : !result ? (
            <section className="card flex min-h-[340px] flex-col items-center justify-center text-center">
              <p className="text-base font-bold text-ink">AI Analysis Results</p>
              <p className="mt-2 max-w-sm text-sm text-mute">
                Upload or load your saved resume, select a live drive or paste a job description, and click{' '}
                <strong>Analyze Resume</strong> to see your section scores, skill gaps, and rewrite suggestions.
              </p>
            </section>
          ) : (
            <>
              <article className="card cc-glow-card">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-5">
                    <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
                      <svg className="h-28 w-28 -rotate-90" viewBox="0 0 112 112" aria-hidden="true">
                        <circle cx="56" cy="56" r={radius} fill="none" stroke="var(--line)" strokeWidth="10" />
                        <circle
                          cx="56"
                          cy="56"
                          r={radius}
                          fill="none"
                          stroke={ringStroke}
                          strokeWidth="10"
                          strokeLinecap="round"
                          strokeDasharray={circumference}
                          strokeDashoffset={dashOffset}
                          className="transition-all duration-500"
                        />
                      </svg>
                      <span className={`absolute font-display text-2xl font-extrabold ${scoreTextClass}`}>
                        {result.score}%
                      </span>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold">ATS Readiness Score</h2>
                        <span className={`pill inline-flex items-center gap-1 ${result.aiPowered ? 'bg-okt text-ok' : 'bg-prit text-pri'}`}>
                          <Sparkles size={12} aria-hidden="true" />
                          {result.aiPowered ? 'Gemini AI' : 'Semantic Local'}
                        </span>
                      </div>
                      {result.targetRole && (
                        <p className="mt-1 text-xs font-semibold text-ink">Target: {result.targetRole}</p>
                      )}
                      {result.summary && <p className="mt-1.5 text-sm text-mute">{result.summary}</p>}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-ghost text-sm"
                    onClick={() => downloadReport(result, resumeFile?.name || 'Resume')}
                  >
                    Download AI Report (PDF)
                  </button>
                </div>

                {sectionList.length > 0 && (
                  <div className="mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
                    {sectionList.map(([label, val]) => (
                      <div key={label} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-mute">{label}</span>
                          <span className="text-ink">{val}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-line">
                          <div className="h-full rounded-full bg-pri transition-all duration-500" style={{ width: `${val}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>

              <div className="grid gap-5 sm:grid-cols-2">
                <article className="card">
                  <h2 className="text-base font-bold text-ok">Matched Skills</h2>
                  {result.matchedKeywords?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {result.matchedKeywords.map((kw) => (
                        <span key={kw} className="pill bg-okt text-ok">{kw}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-mute">No matched skills identified.</p>
                  )}
                </article>

                <article className="card">
                  <h2 className="text-base font-bold text-bad">Missing / Gap Skills</h2>
                  {result.missingKeywords?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {result.missingKeywords.map((kw) => (
                        <span key={kw} className="pill bg-badt text-bad">{kw}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-ok">Strong coverage — no major skill gaps!</p>
                  )}
                </article>
              </div>

              <article className="card">
                <h2 className="text-lg font-bold">Actionable Rewrite Suggestions</h2>
                {result.suggestions?.length ? (
                  <div className="mt-3 grid gap-3">
                    {result.suggestions.map((s, idx) => (
                      <div key={idx} className="rounded-xl border border-line bg-bg p-3.5 text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`pill text-[11px] ${s.priority === 'HIGH' ? 'bg-badt text-bad' : 'bg-prit text-pri'}`}>
                            {s.priority || 'MEDIUM'}
                          </span>
                          <span className="font-bold text-ink">{s.section || 'General'}</span>
                        </div>
                        <p className="mt-1.5 text-ink">{s.advice}</p>
                        {s.exampleRewrite && (
                          <p className="mt-2 rounded-lg border border-line bg-surf p-2.5 text-xs text-mute">
                            <strong className="text-ink">Example rewrite:</strong> {s.exampleRewrite}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-mute">No additional suggestions.</p>
                )}
                {result.disclaimer && (
                  <p className="mt-3 text-xs text-mute">{result.disclaimer}</p>
                )}
              </article>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}