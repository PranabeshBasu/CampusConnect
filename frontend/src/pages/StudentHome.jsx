import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Eye,
  FileText,
  Lock,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { changePassword, updateProfile } from '../api/accounts.js';
import {
  deleteStudentDocument,
  deleteStudentResume,
  downloadStudentResume,
  getStudentProfile,
  getStudentResumeMetadata,
  listStudentDocuments,
  saveStudentProfile,
  uploadStudentDocument,
  uploadStudentResume,
  viewStudentDocument,
  viewStudentResume,
} from '../api/studentProfile.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { validateName, validatePassword } from '../auth/validators.js';
import AppShell from '../components/AppShell.jsx';
import AvatarCropModal from '../components/AvatarCropModal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import Field from '../components/Field.jsx';
import { useToast } from '../components/ToastContext.jsx';
import { getAvatar, setAvatar } from '../lib/avatarStorage.js';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir',
  'Ladakh', 'Lakshadweep', 'Puducherry',
];

const PROFILE_TABS = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'docs', label: 'IDs & Docs' },
  { id: 'school', label: '10th & 12th' },
  { id: 'college', label: 'Semesters & CGPA' },
  { id: 'family', label: 'Parents & Address' },
];

function parseJsonArray(raw, fallback = []) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function resizeSubjects(list, count) {
  const n = Math.max(1, Math.min(12, Number(count) || 5));
  return Array.from({ length: n }, (_, i) => ({
    subject: list[i]?.subject || `Subject ${i + 1}`,
    marks: list[i]?.marks ?? '',
  }));
}

function calcBoardPercentage(subjects) {
  if (!subjects.length) return '';
  const valid = subjects.every(
    (s) => String(s.marks ?? '').trim() !== '' && !Number.isNaN(Number(s.marks)),
  );
  if (!valid) return '';
  const total = subjects.reduce((sum, s) => sum + Number(s.marks), 0);
  return ((total / (subjects.length * 100)) * 100).toFixed(2);
}

function calcCollegeMetrics(sgpas) {
  const valid = sgpas.filter((v) => String(v ?? '').trim() !== '' && !Number.isNaN(Number(v)));
  const ygpas = [];
  for (let y = 0; y < Math.ceil(sgpas.length / 2); y++) {
    const s1 = sgpas[y * 2];
    const s2 = sgpas[y * 2 + 1];
    const nums = [s1, s2]
      .filter((v) => v !== undefined && String(v ?? '').trim() !== '' && !Number.isNaN(Number(v)))
      .map(Number);
    if (nums.length > 0) {
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      ygpas.push({ year: y + 1, ygpa: avg.toFixed(2) });
    }
  }
  if (!valid.length) return { ygpas, cgpa: '', equivPct: '' };
  const cgpaNum = valid.reduce((sum, v) => sum + Number(v), 0) / valid.length;
  const equiv = Math.max(0, Math.min(100, (cgpaNum - 0.75) * 10));
  return {
    ygpas,
    cgpa: cgpaNum.toFixed(2),
    equivPct: equiv.toFixed(2),
  };
}

const emptyProfile = {
  rollNumber: '',
  section: '',
  personalEmail: '',
  phone: '',
  dateOfBirth: '',
  degree: '',
  branch: '',
  graduationYear: '',
  cgpa: '',
  activeBacklogs: '0',
  enrollmentNo: '',
  registrationNo: '',
  tenthPercentage: '',
  twelfthPercentage: '',
  completedSemesters: '0',
  equivalentPercentage: '',
  fatherName: '',
  fatherPhone: '',
  motherName: '',
  motherPhone: '',
  parentEmail: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  district: '',
  state: '',
  pinCode: '',
};

function toFormValues(p) {
  return {
    rollNumber: p.rollNumber ?? '',
    section: p.section ?? '',
    personalEmail: p.personalEmail ?? '',
    phone: p.phone ?? '',
    dateOfBirth: p.dateOfBirth ?? '',
    degree: p.degree ?? '',
    branch: p.branch ?? '',
    graduationYear: p.graduationYear?.toString() ?? '',
    cgpa: p.cgpa?.toString() ?? '',
    activeBacklogs: (p.activeBacklogs ?? 0).toString(),
    enrollmentNo: p.enrollmentNo ?? '',
    registrationNo: p.registrationNo ?? '',
    tenthPercentage: p.tenthPercentage?.toString() ?? '',
    twelfthPercentage: p.twelfthPercentage?.toString() ?? '',
    completedSemesters: (p.completedSemesters ?? 0).toString(),
    equivalentPercentage: p.equivalentPercentage?.toString() ?? '',
    fatherName: p.fatherName ?? '',
    fatherPhone: p.fatherPhone ?? '',
    motherName: p.motherName ?? '',
    motherPhone: p.motherPhone ?? '',
    parentEmail: p.parentEmail ?? '',
    addressLine1: p.addressLine1 ?? '',
    addressLine2: p.addressLine2 ?? '',
    city: p.city ?? '',
    district: p.district ?? '',
    state: p.state ?? '',
    pinCode: p.pinCode ?? '',
  };
}

function validateStudentProfile(form, tenthSubjects, twelfthSubjects, semSgpas) {
  const year = form.graduationYear.trim();
  const cgpa = form.cgpa.trim();
  const backlogs = form.activeBacklogs.trim();

  if (form.rollNumber.length > 40) return 'Roll number must be 40 characters or fewer.';
  if (form.phone.length > 20) return 'Phone number must be 20 characters or fewer.';
  if (form.personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.personalEmail.trim())) {
    return 'Enter a valid personal email address.';
  }
  if (form.parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.parentEmail.trim())) {
    return 'Enter a valid parent email address.';
  }
  if (form.pinCode && !/^\d{6}$/.test(form.pinCode.trim())) {
    return 'PIN code must be 6 digits.';
  }
  if (form.dateOfBirth && form.dateOfBirth >= new Date().toISOString().slice(0, 10)) {
    return 'Date of birth must be in the past.';
  }
  if (year && (!/^\d{4}$/.test(year) || Number(year) < 2000 || Number(year) > 2100)) {
    return 'Graduation year must be between 2000 and 2100.';
  }
  if (cgpa && (!/^\d{1,2}(\.\d{1,2})?$/.test(cgpa) || Number(cgpa) < 0 || Number(cgpa) > 10)) {
    return 'CGPA must be between 0 and 10, with up to two decimal places.';
  }
  if (!/^\d+$/.test(backlogs) || Number(backlogs) > 32767) {
    return 'Active backlogs must be a non-negative whole number.';
  }
  for (const s of [...tenthSubjects, ...twelfthSubjects]) {
    if (String(s.marks ?? '').trim() !== '' && (Number(s.marks) < 0 || Number(s.marks) > 100)) {
      return 'Subject marks must be between 0 and 100.';
    }
  }
  for (const sgpa of semSgpas) {
    if (String(sgpa ?? '').trim() !== '' && (Number(sgpa) < 0 || Number(sgpa) > 10)) {
      return 'Semester SGPA must be between 0 and 10.';
    }
  }
  return '';
}

function DocumentUploadBox({ label, hint, docType, docMeta, disabled, onUploaded, onDeleted }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      toast.error('Only PDF, JPG, or PNG files are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be 5 MB or smaller.');
      return;
    }
    setBusy(true);
    try {
      const meta = await uploadStudentDocument(docType, file);
      onUploaded(meta);
      toast.success(`${label} uploaded.`);
    } catch (err) {
      toast.error(err.message || `Could not upload ${label}.`);
    } finally {
      setBusy(false);
    }
  }

  async function handleView() {
    setBusy(true);
    try {
      const blob = await viewStudentDocument(docType);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      toast.error(err.message || 'Could not open document.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteStudentDocument(docType);
      onDeleted(docType);
      toast.info(`${label} removed.`);
    } catch (err) {
      toast.error(err.message || 'Could not remove document.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-bg p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink">{label}</p>
          <p className="text-xs text-mute">{hint}</p>
        </div>
        {docMeta ? (
          <span className="pill bg-okt text-ok">Uploaded</span>
        ) : (
          <span className="pill bg-line text-mute">Missing</span>
        )}
      </div>

      {docMeta && (
        <p className="mt-2 truncate text-xs text-mute">
          File: <span className="font-medium text-ink">{docMeta.fileName}</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className={`btn-ghost cursor-pointer text-xs ${busy || disabled ? 'pointer-events-none opacity-50' : ''}`}>
          <Upload size={13} aria-hidden="true" />
          {busy ? 'Uploading…' : docMeta ? 'Replace file' : 'Upload file'}
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            className="sr-only"
            disabled={busy || disabled}
            onChange={handleFile}
          />
        </label>
        {docMeta && (
          <>
            <button type="button" className="btn-ghost text-xs" disabled={busy} onClick={handleView}>
              <Eye size={13} aria-hidden="true" /> View
            </button>
            <button
              type="button"
              className="btn-ghost text-xs text-bad hover:border-bad"
              disabled={busy || disabled}
              onClick={handleDelete}
            >
              <Trash2 size={13} aria-hidden="true" /> Remove
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function StudentHome() {
  const { user, refresh } = useAuth();
  const toast = useToast();

  const [avatarUrl, setAvatarUrl] = useState(() => getAvatar(user.email));
  const [avatarError, setAvatarError] = useState('');
  const [cropSrc, setCropSrc] = useState('');

  const [name, setName] = useState(user.fullName);
  const [nameError, setNameError] = useState('');
  const [nameMsg, setNameMsg] = useState('');

  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwError, setPwError] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  const [activeTab, setActiveTab] = useState('basic');
  const [profile, setProfile] = useState(emptyProfile);
  const [tenthSubjects, setTenthSubjects] = useState(() => resizeSubjects([], 5));
  const [twelfthSubjects, setTwelfthSubjects] = useState(() => resizeSubjects([], 5));
  const [semSgpas, setSemSgpas] = useState([]);
  const [docsMap, setDocsMap] = useState({});

  const [profileVerified, setProfileVerified] = useState(false);
  const [verificationNote, setVerificationNote] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const [resumeFile, setResumeFile] = useState(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeError, setResumeError] = useState('');
  const [resumeMsg, setResumeMsg] = useState('');
  const [resumeMeta, setResumeMeta] = useState({ hasResume: false, fileName: '' });
  const [resumeActionBusy, setResumeActionBusy] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  useEffect(() => {
    let active = true;

    getStudentResumeMetadata()
      .then((metadata) => {
        if (active) setResumeMeta(metadata);
      })
      .catch(() => {});

    listStudentDocuments()
      .then((list) => {
        if (!active) return;
        const map = {};
        (list || []).forEach((d) => {
          const key = d.docType || d.documentType;
          if (key) map[key] = d;
        });
        setDocsMap(map);
      })
      .catch(() => {});

    getStudentProfile()
      .then((data) => {
        if (!active) return;
        setProfile(toFormValues(data));
        const t10 = parseJsonArray(data.tenthSubjectsJson);
        setTenthSubjects(resizeSubjects(t10, t10.length || 5));
        const t12 = parseJsonArray(data.twelfthSubjectsJson);
        setTwelfthSubjects(resizeSubjects(t12, t12.length || 5));
        const sems = parseJsonArray(data.semesterSgpasJson);
        const count = data.completedSemesters || sems.length || 0;
        setSemSgpas(Array.from({ length: count }, (_, i) => sems[i]?.sgpa ?? ''));
        setProfileVerified(Boolean(data.verified));
        setVerificationNote(data.verificationNote || '');
        setProfileError('');
      })
      .catch((error) => {
        if (!active) return;
        if (error.status === 404) {
          setProfile(emptyProfile);
          setProfileVerified(false);
        } else {
          setProfileError(error.message || 'Could not load your student profile.');
        }
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const tenthPct = useMemo(() => calcBoardPercentage(tenthSubjects), [tenthSubjects]);
  const twelfthPct = useMemo(() => calcBoardPercentage(twelfthSubjects), [twelfthSubjects]);
  const collegeMetrics = useMemo(() => calcCollegeMetrics(semSgpas), [semSgpas]);

  useEffect(() => {
    setProfile((p) => {
      const nextTenth = tenthPct || p.tenthPercentage;
      const nextTwelfth = twelfthPct || p.twelfthPercentage;
      const nextCgpa = collegeMetrics.cgpa || p.cgpa;
      const nextEquiv = collegeMetrics.equivPct || p.equivalentPercentage;
      if (
        nextTenth === p.tenthPercentage &&
        nextTwelfth === p.twelfthPercentage &&
        nextCgpa === p.cgpa &&
        nextEquiv === p.equivalentPercentage
      ) {
        return p;
      }
      return {
        ...p,
        tenthPercentage: nextTenth,
        twelfthPercentage: nextTwelfth,
        cgpa: nextCgpa,
        equivalentPercentage: nextEquiv,
      };
    });
  }, [tenthPct, twelfthPct, collegeMetrics.cgpa, collegeMetrics.equivPct]);

  const completeness = useMemo(() => {
    const checks = [
      profile.rollNumber,
      profile.phone,
      profile.dateOfBirth,
      profile.degree,
      profile.branch,
      profile.graduationYear,
      profile.cgpa,
      tenthPct || profile.tenthPercentage,
      twelfthPct || profile.twelfthPercentage,
      profile.fatherName,
      profile.addressLine1,
      profile.state,
      resumeMeta.hasResume,
      docsMap.AADHAAR_ID,
      docsMap.COLLEGE_ID,
    ];
    const filled = checks.filter((v) => (typeof v === 'boolean' ? v : String(v || '').trim().length > 0)).length;
    return Math.round((filled / checks.length) * 100);
  }, [profile, tenthPct, twelfthPct, resumeMeta.hasResume, docsMap]);

  const isNameDirty = name.trim() !== user.fullName.trim();

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAvatarError('Please choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Image must be 5 MB or smaller.');
      return;
    }
    setCropSrc(URL.createObjectURL(file));
  }

  function closeCropModal() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc('');
  }

  function handleCropSave(dataUrl) {
    try {
      setAvatar(user.email, dataUrl);
      setAvatarUrl(dataUrl);
      closeCropModal();
      toast.success('Profile photo updated!');
    } catch (err) {
      setAvatarError(err.message);
      toast.error(err.message);
    }
  }

  function handleRemoveAvatar() {
    setAvatar(user.email, '');
    setAvatarUrl('');
    setAvatarError('');
    toast.info('Profile photo removed.');
  }

  async function saveName(e) {
    e.preventDefault();
    setNameMsg('');
    const err = validateName(name);
    setNameError(err);
    if (err) return;
    try {
      await updateProfile(name.trim());
      await refresh();
      setNameMsg('Name updated.');
      setNameError('');
      toast.success('Name updated!');
    } catch (ex) {
      setNameError(ex.message);
      toast.error(ex.message || 'Could not update name.');
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setPwMsg('');
    const err = pw.current ? validatePassword(pw.next) : 'Enter your current password.';
    setPwError(err);
    if (err) return;
    try {
      await changePassword(pw.current, pw.next);
      setPw({ current: '', next: '' });
      setPwMsg('Password changed.');
      setPwError('');
      toast.success('Password changed!');
    } catch (ex) {
      setPwError(ex.message);
      toast.error(ex.message || 'Could not change password.');
    }
  }

  function updateField(field, value) {
    setProfile((current) => ({ ...current, [field]: value }));
    setProfileMsg('');
    setProfileError('');
  }

  async function saveStudentDetails(e) {
    e.preventDefault();
    setProfileMsg('');

    const error = validateStudentProfile(profile, tenthSubjects, twelfthSubjects, semSgpas);
    if (error) {
      setProfileError(error);
      toast.error(error);
      return;
    }

    setProfileSaving(true);
    setProfileError('');

    const computed10 = tenthPct || profile.tenthPercentage;
    const computed12 = twelfthPct || profile.twelfthPercentage;
    const semPayload = semSgpas.map((sgpa, i) => ({ semester: i + 1, sgpa }));

    const payload = {
      rollNumber: profile.rollNumber.trim() || null,
      section: profile.section.trim() || null,
      personalEmail: profile.personalEmail.trim() || null,
      phone: profile.phone.trim() || null,
      dateOfBirth: profile.dateOfBirth || null,
      degree: profile.degree.trim() || null,
      branch: profile.branch.trim() || null,
      graduationYear: profile.graduationYear ? Number(profile.graduationYear) : null,
      cgpa: profile.cgpa ? Number(profile.cgpa) : null,
      activeBacklogs: Number(profile.activeBacklogs || 0),
      tenthPercentage: computed10 ? Number(computed10) : null,
      tenthSubjectsJson: JSON.stringify(tenthSubjects),
      twelfthPercentage: computed12 ? Number(computed12) : null,
      twelfthSubjectsJson: JSON.stringify(twelfthSubjects),
      completedSemesters: semSgpas.length,
      semesterSgpasJson: JSON.stringify(semPayload),
      ygpaJson: JSON.stringify(collegeMetrics.ygpas),
      equivalentPercentage: profile.equivalentPercentage ? Number(profile.equivalentPercentage) : null,
      fatherName: profile.fatherName.trim() || null,
      fatherPhone: profile.fatherPhone.trim() || null,
      motherName: profile.motherName.trim() || null,
      motherPhone: profile.motherPhone.trim() || null,
      parentEmail: profile.parentEmail.trim() || null,
      addressLine1: profile.addressLine1.trim() || null,
      addressLine2: profile.addressLine2.trim() || null,
      city: profile.city.trim() || null,
      district: profile.district.trim() || null,
      state: profile.state.trim() || null,
      pinCode: profile.pinCode.trim() || null,
    };

    try {
      const saved = await saveStudentProfile(payload);
      setProfile(toFormValues(saved));
      setProfileVerified(Boolean(saved.verified));
      setVerificationNote(saved.verificationNote || '');
      setProfileMsg('Student profile saved successfully.');
      toast.success('Student profile saved!');
    } catch (err) {
      const msg = err.message || 'Could not save your student profile.';
      setProfileError(msg);
      toast.error(msg);
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleResumeUpload(e) {
    e.preventDefault();
    setResumeError('');
    setResumeMsg('');
    if (!resumeFile) return setResumeError('Please choose a PDF resume first.');
    if (resumeFile.type !== 'application/pdf') return setResumeError('Only PDF files are allowed.');
    if (resumeFile.size > 5 * 1024 * 1024) return setResumeError('Resume must be 5 MB or smaller.');

    setResumeUploading(true);
    try {
      await uploadStudentResume(resumeFile);
      setResumeMeta({ hasResume: true, fileName: resumeFile.name });
      setResumeMsg('Resume uploaded successfully.');
      toast.success('Resume uploaded!');
      setResumeFile(null);
      e.target.reset();
    } catch (err) {
      setResumeError(err.message || 'Could not upload resume.');
    } finally {
      setResumeUploading(false);
    }
  }

  async function resumeBlobAction(action) {
    setResumeError('');
    setResumeActionBusy(true);
    try {
      const blob = action === 'view' ? await viewStudentResume() : await downloadStudentResume();
      const url = URL.createObjectURL(blob);
      if (action === 'view') {
        window.open(url, '_blank', 'noopener,noreferrer');
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = resumeMeta.fileName || 'resume.pdf';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (err) {
      setResumeError(err.message || 'Could not access the uploaded resume.');
    } finally {
      setResumeActionBusy(false);
    }
  }

  async function confirmDeleteResume() {
    setResumeError('');
    setResumeActionBusy(true);
    try {
      await deleteStudentResume();
      setResumeMeta({ hasResume: false, fileName: '' });
      setResumeMsg('Resume deleted.');
      setDeleteModalOpen(false);
      toast.info('Resume deleted.');
    } catch (err) {
      setResumeError(err.message || 'Could not delete resume.');
    } finally {
      setResumeActionBusy(false);
    }
  }

  const fromRegistry = Boolean(profile.enrollmentNo);

  return (
    <AppShell>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold">My account</h1>
        <span className={`pill inline-flex items-center gap-1.5 ${completeness === 100 ? 'bg-okt text-ok' : 'bg-prit text-pri'}`}>
          <CheckCircle2 size={14} aria-hidden="true" />
          Profile {completeness}% Complete
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="grid content-start gap-6 lg:col-span-4">
          <section className="card" aria-labelledby="acct">
            <h2 id="acct" className="text-lg font-bold">Account details</h2>
            <div className="mt-3 flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-prit text-lg font-extrabold text-pri">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={user.fullName} className="h-full w-full object-cover" />
                ) : (
                  user.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || 'S'
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="btn-ghost cursor-pointer text-xs">
                  <Camera size={14} aria-hidden="true" />
                  {avatarUrl ? 'Change photo' : 'Upload photo'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleAvatarChange} />
                </label>
                {avatarUrl && (
                  <button type="button" onClick={handleRemoveAvatar} className="btn-ghost text-xs text-bad">
                    <Trash2 size={14} aria-hidden="true" /> Remove
                  </button>
                )}
              </div>
            </div>
            {avatarError && <p role="alert" className="mt-2 text-xs text-bad">{avatarError}</p>}

            <dl className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
              <dt className="text-mute">College Email</dt>
              <dd className="truncate font-medium">{user.email}</dd>
              <dt className="text-mute">Role</dt>
              <dd><span className="pill bg-prit text-pri">Student</span></dd>
            </dl>

            <form onSubmit={saveName} noValidate className="mt-3">
              <Field id="name" label="Full name" value={name} onChange={setName} disabled={fromRegistry} error={nameError} />
              {!fromRegistry && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="submit" className="btn" disabled={!isNameDirty}>Save name</button>
                  {nameMsg && <span role="status" className="text-sm text-ok">{nameMsg}</span>}
                </div>
              )}
            </form>
          </section>

          <section className="card" aria-labelledby="resume">
            <h2 id="resume" className="text-lg font-bold">Resume</h2>
            <p className="mt-1 text-sm text-mute">Upload your resume as a PDF (max 5 MB).</p>

            {resumeMeta.hasResume && (
              <div className="mt-3 rounded-xl border border-line bg-bg p-3">
                <div className="flex items-center gap-2 text-sm">
                  <FileText size={18} className="shrink-0 text-pri" aria-hidden="true" />
                  <span className="truncate font-semibold text-ink">{resumeMeta.fileName || 'Uploaded PDF'}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="btn-ghost text-xs" disabled={resumeActionBusy} onClick={() => resumeBlobAction('view')}>View</button>
                  <button type="button" className="btn-ghost text-xs" disabled={resumeActionBusy} onClick={() => resumeBlobAction('download')}>Download</button>
                  <button type="button" className="btn-ghost text-xs text-bad hover:border-bad" disabled={resumeActionBusy} onClick={() => setDeleteModalOpen(true)}>Delete</button>
                </div>
              </div>
            )}

            <form onSubmit={handleResumeUpload} className="mt-4 grid gap-3">
              <input
                id="resumePdf"
                type="file"
                accept=".pdf,application/pdf"
                className="block w-full text-sm file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-pri file:px-4 file:py-2 file:font-semibold file:text-onpri hover:file:opacity-90"
                onChange={(e) => { setResumeFile(e.target.files?.[0] || null); setResumeError(''); setResumeMsg(''); }}
              />
              {resumeError && <p role="alert" className="text-sm text-bad">{resumeError}</p>}
              {resumeMsg && <p role="status" className="text-sm text-ok">{resumeMsg}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="btn" disabled={resumeUploading || !resumeFile}>{resumeUploading ? 'Uploading…' : 'Upload resume'}</button>
                <Link to="/student/ats" state={{ preloadSavedResume: resumeMeta.hasResume, fileName: resumeMeta.fileName }} className="btn-ghost inline-flex items-center gap-1.5 text-pri hover:border-pri">
                  ATS Analyzer <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </form>
          </section>

          <section className="card" aria-labelledby="pw">
            <h2 id="pw" className="text-lg font-bold">Change password</h2>
            <form onSubmit={savePassword} noValidate>
              <Field id="cur" label="Current password" type="password" autoComplete="current-password" value={pw.current} onChange={(v) => setPw({ ...pw, current: v })} />
              <Field id="new" label="New password" type="password" autoComplete="new-password" value={pw.next} onChange={(v) => setPw({ ...pw, next: v })} error={pwError} />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="submit" className="btn">Change password</button>
                {pwMsg && <span role="status" className="text-sm text-ok">{pwMsg}</span>}
              </div>
            </form>
          </section>
        </div>

        <section className="card h-fit lg:col-span-8" aria-labelledby="student-profile">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="student-profile" className="text-lg font-bold">Student profile &amp; verification</h2>
              <p className="mt-1 text-sm text-mute">Complete all sections for placement eligibility and SPOC verification.</p>
            </div>
            {profileVerified && (
              <span className="pill inline-flex items-center gap-1.5 bg-okt text-ok">
                <ShieldCheck size={14} aria-hidden="true" /> Verified &amp; Locked
              </span>
            )}
          </div>

          {profileVerified && (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-line bg-bg p-3 text-xs text-mute">
              <Lock size={14} className="mt-0.5 shrink-0 text-ok" aria-hidden="true" />
              <div>
                <p className="font-semibold text-ink">Academic scores and backlogs are locked by your Department SPOC.</p>
                {verificationNote && <p className="mt-0.5">Note: {verificationNote}</p>}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-1.5 border-b border-line pb-3" role="tablist">
            {PROFILE_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activeTab === t.id}
                onClick={() => setActiveTab(t.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === t.id ? 'bg-pri text-onpri' : 'bg-bg text-mute hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {profileLoading ? (
            <p role="status" className="mt-4 text-sm text-mute">Loading student profile…</p>
          ) : (
            <form onSubmit={saveStudentDetails} noValidate className="mt-4 space-y-5">
              {activeTab === 'basic' && (
                <div className="grid gap-1 sm:grid-cols-2 sm:gap-x-4">
                  <Field id="enrollmentNo" label="Enrollment No" value={profile.enrollmentNo} disabled onChange={() => {}} />
                  <Field id="registrationNo" label="Registration No" value={profile.registrationNo} disabled onChange={() => {}} />
                  <Field id="degree" label="Degree" value={profile.degree} disabled={fromRegistry} onChange={(v) => updateField('degree', v)} />
                  <Field id="branch" label="Stream" value={profile.branch} disabled={fromRegistry} onChange={(v) => updateField('branch', v)} />
                  <Field id="rollNumber" label="College Roll Number" value={profile.rollNumber} onChange={(v) => updateField('rollNumber', v)} />
                  <Field id="section" label="Section" placeholder="e.g. A" value={profile.section} onChange={(v) => updateField('section', v)} />
                  <Field id="personalEmail" label="Personal Gmail" type="email" placeholder="you@gmail.com" value={profile.personalEmail} onChange={(v) => updateField('personalEmail', v)} />
                  <Field id="phone" label="Phone" type="tel" value={profile.phone} onChange={(v) => updateField('phone', v)} />
                  <Field id="dateOfBirth" label="Date of birth" type="date" value={profile.dateOfBirth} onChange={(v) => updateField('dateOfBirth', v)} />
                  <Field id="graduationYear" label="Graduation year" type="number" value={profile.graduationYear} onChange={(v) => updateField('graduationYear', v)} />
                </div>
              )}

              {activeTab === 'docs' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <DocumentUploadBox
                    label="Government ID (Aadhaar Card)"
                    hint="PDF, JPG, or PNG (max 5 MB)"
                    docType="AADHAAR_ID"
                    docMeta={docsMap.AADHAAR_ID}
                    disabled={profileVerified}
                    onUploaded={(m) => setDocsMap((d) => ({ ...d, AADHAAR_ID: m }))}
                    onDeleted={(t) => setDocsMap((d) => { const n = { ...d }; delete n[t]; return n; })}
                  />
                  <DocumentUploadBox
                    label="College Student ID Card"
                    hint="PDF, JPG, or PNG (max 5 MB)"
                    docType="COLLEGE_ID"
                    docMeta={docsMap.COLLEGE_ID}
                    disabled={profileVerified}
                    onUploaded={(m) => setDocsMap((d) => ({ ...d, COLLEGE_ID: m }))}
                    onDeleted={(t) => setDocsMap((d) => { const n = { ...d }; delete n[t]; return n; })}
                  />
                </div>
              )}

              {activeTab === 'school' && (
                <div className="space-y-6">
                  <div className="rounded-xl border border-line p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-bold">Class 10th</h3>
                      <span className="pill bg-prit text-pri">
                        Percentage: {tenthPct || profile.tenthPercentage || '—'}%
                      </span>
                    </div>
                    <DocumentUploadBox
                      label="10th Marksheet"
                      hint="PDF, JPG, or PNG (max 5 MB)"
                      docType="TENTH_MARKSHEET"
                      docMeta={docsMap.TENTH_MARKSHEET}
                      disabled={profileVerified}
                      onUploaded={(m) => setDocsMap((d) => ({ ...d, TENTH_MARKSHEET: m }))}
                      onDeleted={(t) => setDocsMap((d) => { const n = { ...d }; delete n[t]; return n; })}
                    />
                    <div className="flex items-center gap-3">
                      <label htmlFor="sub10Count" className="text-sm font-medium">Number of subjects:</label>
                      <select
                        id="sub10Count"
                        disabled={profileVerified}
                        value={tenthSubjects.length}
                        onChange={(e) => setTenthSubjects((prev) => resizeSubjects(prev, e.target.value))}
                        className="rounded-lg border border-line bg-bg px-3 py-1.5 text-sm"
                      >
                        {[5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n} subjects</option>)}
                      </select>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {tenthSubjects.map((s, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input
                            type="text"
                            placeholder={`Subject ${idx + 1}`}
                            disabled={profileVerified}
                            value={s.subject}
                            onChange={(e) => {
                              const next = [...tenthSubjects];
                              next[idx] = { ...next[idx], subject: e.target.value };
                              setTenthSubjects(next);
                            }}
                            className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm"
                          />
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="/100"
                            disabled={profileVerified}
                            value={s.marks}
                            onChange={(e) => {
                              const next = [...tenthSubjects];
                              next[idx] = { ...next[idx], marks: e.target.value };
                              setTenthSubjects(next);
                            }}
                            className="w-24 rounded-lg border border-line bg-bg px-3 py-1.5 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-line p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-bold">Class 12th / Diploma</h3>
                      <span className="pill bg-prit text-pri">
                        Percentage: {twelfthPct || profile.twelfthPercentage || '—'}%
                      </span>
                    </div>
                    <DocumentUploadBox
                      label="12th Marksheet"
                      hint="PDF, JPG, or PNG (max 5 MB)"
                      docType="TWELFTH_MARKSHEET"
                      docMeta={docsMap.TWELFTH_MARKSHEET}
                      disabled={profileVerified}
                      onUploaded={(m) => setDocsMap((d) => ({ ...d, TWELFTH_MARKSHEET: m }))}
                      onDeleted={(t) => setDocsMap((d) => { const n = { ...d }; delete n[t]; return n; })}
                    />
                    <div className="flex items-center gap-3">
                      <label htmlFor="sub12Count" className="text-sm font-medium">Number of subjects:</label>
                      <select
                        id="sub12Count"
                        disabled={profileVerified}
                        value={twelfthSubjects.length}
                        onChange={(e) => setTwelfthSubjects((prev) => resizeSubjects(prev, e.target.value))}
                        className="rounded-lg border border-line bg-bg px-3 py-1.5 text-sm"
                      >
                        {[5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n} subjects</option>)}
                      </select>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {twelfthSubjects.map((s, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input
                            type="text"
                            placeholder={`Subject ${idx + 1}`}
                            disabled={profileVerified}
                            value={s.subject}
                            onChange={(e) => {
                              const next = [...twelfthSubjects];
                              next[idx] = { ...next[idx], subject: e.target.value };
                              setTwelfthSubjects(next);
                            }}
                            className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm"
                          />
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="/100"
                            disabled={profileVerified}
                            value={s.marks}
                            onChange={(e) => {
                              const next = [...twelfthSubjects];
                              next[idx] = { ...next[idx], marks: e.target.value };
                              setTwelfthSubjects(next);
                            }}
                            className="w-24 rounded-lg border border-line bg-bg px-3 py-1.5 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'college' && (
                <div className="space-y-4">
                  <DocumentUploadBox
                    label="All-Semester Transcript (Combined PDF)"
                    hint="Upload latest consolidated marksheets/transcript PDF (max 5 MB)"
                    docType="SEMESTER_TRANSCRIPT"
                    docMeta={docsMap.SEMESTER_TRANSCRIPT}
                    disabled={profileVerified}
                    onUploaded={(m) => setDocsMap((d) => ({ ...d, SEMESTER_TRANSCRIPT: m }))}
                    onDeleted={(t) => setDocsMap((d) => { const n = { ...d }; delete n[t]; return n; })}
                  />

                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <label htmlFor="semCount" className="block text-sm font-medium">Completed semesters</label>
                      <select
                        id="semCount"
                        disabled={profileVerified}
                        value={semSgpas.length}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setSemSgpas((prev) => Array.from({ length: n }, (_, i) => prev[i] ?? ''));
                        }}
                        className="mt-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm"
                      >
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                          <option key={n} value={n}>{n} semesters</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <Field
                        id="activeBacklogs"
                        label="Active backlogs"
                        type="number"
                        value={profile.activeBacklogs}
                        disabled={profileVerified}
                        onChange={(v) => updateField('activeBacklogs', v)}
                      />
                    </div>
                  </div>

                  {semSgpas.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-4">
                      {semSgpas.map((val, idx) => (
                        <Field
                          key={idx}
                          id={`sem-${idx + 1}`}
                          label={`Sem ${idx + 1} SGPA`}
                          type="number"
                          step="0.01"
                          disabled={profileVerified}
                          value={val}
                          onChange={(v) => {
                            const next = [...semSgpas];
                            next[idx] = v;
                            setSemSgpas(next);
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {collegeMetrics.ygpas.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {collegeMetrics.ygpas.map((y) => (
                        <span key={y.year} className="pill bg-bg text-ink border border-line">
                          Year {y.year} YGPA: {y.ygpa}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="grid gap-4 rounded-xl border border-line bg-bg p-3.5 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase text-mute">Overall CGPA</p>
                      <p className="mt-1 text-2xl font-extrabold text-pri">{profile.cgpa || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-mute">Equivalent % — (CGPA − 0.75) × 10</p>
                      <p className="mt-1 text-2xl font-extrabold text-ok">
                        {profile.equivalentPercentage ? `${profile.equivalentPercentage}%` : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'family' && (
                <div className="space-y-4">
                  <div className="grid gap-1 sm:grid-cols-2 sm:gap-x-4">
                    <Field id="fatherName" label="Father's name" value={profile.fatherName} onChange={(v) => updateField('fatherName', v)} />
                    <Field id="fatherPhone" label="Father's contact" type="tel" value={profile.fatherPhone} onChange={(v) => updateField('fatherPhone', v)} />
                    <Field id="motherName" label="Mother's name" value={profile.motherName} onChange={(v) => updateField('motherName', v)} />
                    <Field id="motherPhone" label="Mother's contact" type="tel" value={profile.motherPhone} onChange={(v) => updateField('motherPhone', v)} />
                    <div className="sm:col-span-2">
                      <Field id="parentEmail" label="Parent email" type="email" value={profile.parentEmail} onChange={(v) => updateField('parentEmail', v)} />
                    </div>
                  </div>

                  <div className="border-t border-line pt-4 grid gap-1 sm:grid-cols-2 sm:gap-x-4">
                    <div className="sm:col-span-2">
                      <Field id="addressLine1" label="Address line 1" value={profile.addressLine1} onChange={(v) => updateField('addressLine1', v)} />
                    </div>
                    <div className="sm:col-span-2">
                      <Field id="addressLine2" label="Address line 2 / Locality" value={profile.addressLine2} onChange={(v) => updateField('addressLine2', v)} />
                    </div>
                    <Field id="city" label="City / Town" value={profile.city} onChange={(v) => updateField('city', v)} />
                    <Field id="district" label="District" value={profile.district} onChange={(v) => updateField('district', v)} />
                    <div className="mt-3">
                      <label htmlFor="state" className="block text-sm font-medium text-ink">State / UT</label>
                      <select
                        id="state"
                        value={profile.state}
                        onChange={(e) => updateField('state', e.target.value)}
                        className="mt-1 block w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink"
                      >
                        <option value="">Select state…</option>
                        {INDIAN_STATES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>
                    <Field id="pinCode" label="PIN code" value={profile.pinCode} onChange={(v) => updateField('pinCode', v)} />
                  </div>
                </div>
              )}

              {profileError && <p role="alert" className="text-sm text-bad">{profileError}</p>}
              {profileMsg && <p role="status" className="text-sm text-ok">{profileMsg}</p>}

              <div className="border-t border-line pt-4">
                <button type="submit" className="btn" disabled={profileSaving}>
                  {profileSaving ? 'Saving…' : 'Save student profile'}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>

      <ConfirmModal
        open={deleteModalOpen}
        title="Delete uploaded resume?"
        description="Your saved PDF resume will be permanently removed from CampusConnect. You can upload a new one anytime."
        confirmLabel="Delete resume"
        busy={resumeActionBusy}
        onConfirm={confirmDeleteResume}
        onCancel={() => setDeleteModalOpen(false)}
      />

      <AvatarCropModal
        src={cropSrc}
        onCancel={closeCropModal}
        onSave={handleCropSave}
      />
    </AppShell>
  );
}