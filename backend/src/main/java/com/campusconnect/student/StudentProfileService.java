package com.campusconnect.student;

import com.campusconnect.auth.AuthUser;
import com.campusconnect.common.ApiException;
import com.campusconnect.student.AiResumeAnalyzerClient.AnalysisResult;
import com.campusconnect.student.AiResumeAnalyzerClient.ResumeSuggestion;
import com.campusconnect.student.AiResumeAnalyzerClient.SectionScores;
import com.campusconnect.student.StudentProfileDtos.StudentProfileResponse;
import com.campusconnect.student.StudentProfileDtos.UpdateStudentProfileRequest;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class StudentProfileService {

    private static final long MAX_RESUME_BYTES = 5L * 1024 * 1024;
    private static final String ANALYSIS_DISCLAIMER =
            "Advisory guidance only; does not guarantee ATS ranking or invent qualifications.";

    private final StudentProfileRepository studentProfileRepository;

    @Autowired(required = false)
    private StudentRegistryRepository registryRepository;

    @Autowired(required = false)
    private ResumeAnalysisRepository resumeAnalysisRepository;

    @Autowired(required = false)
    private AiResumeAnalyzerClient aiResumeAnalyzerClient;

    @Autowired(required = false)
    private ObjectMapper objectMapper;

    public StudentProfileService(StudentProfileRepository studentProfileRepository) {
        this.studentProfileRepository = studentProfileRepository;
    }

    public record ResumeMetadata(boolean hasResume, String fileName, Instant uploadedAt) {
    }

    public record ResumeFile(String fileName, byte[] data) {
    }

    public record ResumeAnalysis(
            Long id,
            String targetRole,
            String resumeFileName,
            int score,
            SectionScores sectionScores,
            List<String> matchedKeywords,
            List<String> missingKeywords,
            List<ResumeSuggestion> suggestions,
            String summary,
            boolean aiPowered,
            String disclaimer,
            Instant createdAt) {

        public ResumeAnalysis(
                int score,
                List<String> matchedKeywords,
                List<String> missingKeywords,
                String disclaimer) {
            this(
                    null,
                    null,
                    null,
                    score,
                    new SectionScores(score, score, score, score),
                    matchedKeywords,
                    missingKeywords,
                    List.of(),
                    null,
                    false,
                    disclaimer,
                    Instant.now()
            );
        }
    }

    @Transactional
    public StudentProfileResponse getMyProfile(AuthUser user) {
        StudentProfile profile = studentProfileRepository.findByUserId(user.id()).orElse(null);

        if (profile == null) {
            if (registryRepository != null) {
                StudentRegistry reg = findRegistryByUser(user.id());
                if (reg != null) {
                    profile = new StudentProfile(user.id());
                    profile.syncFromRegistry(reg);
                    profile = studentProfileRepository.save(profile);
                }
            }
            if (profile == null) {
                throw new ApiException(HttpStatus.NOT_FOUND, "Student profile not found.");
            }
        } else if (registryRepository != null && profile.getEnrollmentNo() == null) {
            StudentRegistry reg = findRegistryByUser(user.id());
            if (reg != null) {
                profile.syncFromRegistry(reg);
                profile = studentProfileRepository.save(profile);
            }
        }

        return StudentProfileResponse.from(profile);
    }

    @Transactional
    public StudentProfileResponse updateMyProfile(AuthUser user, UpdateStudentProfileRequest request) {
        StudentProfile profile = studentProfileRepository.findByUserId(user.id())
                .orElseGet(() -> new StudentProfile(user.id()));

        if (registryRepository != null) {
            StudentRegistry reg = findRegistryByUser(user.id());
            if (reg != null) {
                profile.syncFromRegistry(reg);
            }
        }

        short requestedBacklogs = request.activeBacklogs() == null ? 0 : request.activeBacklogs();
        short currentBacklogs = profile.getActiveBacklogs() == null ? 0 : profile.getActiveBacklogs();

        if (profile.isVerified() && (
                !Objects.equals(profile.getCgpa(), request.cgpa()) ||
                currentBacklogs != requestedBacklogs)) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Your CGPA and active backlogs are verified and locked by your Department SPOC."
            );
        }

        String roll = trimToNull(request.rollNumber());
        if (roll != null && !roll.equalsIgnoreCase(profile.getRollNumber())
                && studentProfileRepository.existsByRollNumberIgnoreCase(roll)) {
            throw new ApiException(HttpStatus.CONFLICT, "That roll number is already in use.");
        }

        String effectiveDegree = profile.getEnrollmentNo() != null
                ? profile.getDegree()
                : trimToNull(request.degree());
        String effectiveBranch = profile.getEnrollmentNo() != null
                ? profile.getBranch()
                : trimToNull(request.branch());

        profile.updateDetails(
                roll,
                trimToNull(request.phone()),
                request.dateOfBirth(),
                effectiveDegree,
                effectiveBranch,
                request.graduationYear(),
                request.cgpa(),
                requestedBacklogs,
                trimToNull(request.resumeUrl())
        );

        BigDecimal equivPct = computeEquivalentPercentage(request.cgpa(), request.equivalentPercentage());

        profile.updateExtendedDetails(
                trimToNull(request.section()),
                trimToNull(request.personalEmail()),
                request.tenthPercentage(),
                trimToNull(request.tenthSubjectsJson()),
                request.twelfthPercentage(),
                trimToNull(request.twelfthSubjectsJson()),
                request.completedSemesters(),
                trimToNull(request.semesterSgpasJson()),
                trimToNull(request.ygpaJson()),
                equivPct,
                trimToNull(request.fatherName()),
                trimToNull(request.fatherPhone()),
                trimToNull(request.motherName()),
                trimToNull(request.motherPhone()),
                trimToNull(request.parentEmail()),
                trimToNull(request.addressLine1()),
                trimToNull(request.addressLine2()),
                trimToNull(request.city()),
                trimToNull(request.district()),
                trimToNull(request.state()),
                trimToNull(request.pinCode())
        );

        try {
            return StudentProfileResponse.from(studentProfileRepository.saveAndFlush(profile));
        } catch (DataIntegrityViolationException ex) {
            throw new ApiException(HttpStatus.CONFLICT, "That roll number is already in use.");
        }
    }

    @Transactional
    public void uploadResume(AuthUser user, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Please choose a PDF resume.");
        }
        if (file.getSize() > MAX_RESUME_BYTES) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Resume must be 5 MB or smaller.");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.equalsIgnoreCase("application/pdf")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Only PDF files are allowed.");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
            try (PDDocument doc = Loader.loadPDF(bytes)) {
                if (doc.getNumberOfPages() < 1) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "The uploaded PDF could not be read.");
                }
            }
        } catch (ApiException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "The uploaded PDF could not be read.");
        }

        StudentProfile profile = studentProfileRepository.findByUserId(user.id())
                .orElseGet(() -> new StudentProfile(user.id()));

        String fileName = file.getOriginalFilename() != null && !file.getOriginalFilename().isBlank()
                ? file.getOriginalFilename()
                : "resume.pdf";

        profile.storeResume(fileName, contentType, bytes);
        studentProfileRepository.save(profile);
    }

    @Transactional(readOnly = true)
    public ResumeMetadata getResumeMetadata(AuthUser user) {
        return studentProfileRepository.findByUserId(user.id())
                .filter(StudentProfile::hasResume)
                .map(p -> new ResumeMetadata(true, p.getResumeFileName(), p.getResumeUploadedAt()))
                .orElseGet(() -> new ResumeMetadata(false, null, null));
    }

    @Transactional(readOnly = true)
    public ResumeFile getMyResume(AuthUser user) {
        StudentProfile profile = studentProfileRepository.findByUserId(user.id())
                .filter(StudentProfile::hasResume)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Resume not found. Upload a PDF first."));
        String name = profile.getResumeFileName() != null ? profile.getResumeFileName() : "resume.pdf";
        return new ResumeFile(name, profile.getResumeData());
    }

    @Transactional
    public void deleteMyResume(AuthUser user) {
        StudentProfile profile = studentProfileRepository.findByUserId(user.id())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Resume not found."));
        profile.removeResume();
        studentProfileRepository.save(profile);
    }

    @Transactional
    public ResumeAnalysis analyzeResume(AuthUser user, String jobDescription) {
        return analyzeResume(user, jobDescription, null, null);
    }

    @Transactional
    public ResumeAnalysis analyzeResume(
            AuthUser user,
            String jobDescription,
            String targetRole,
            String resumeTextOverride) {
        String resumeText = trimToNull(resumeTextOverride);
        String fileName = "Pasted Resume Text";

        if (resumeText == null) {
            StudentProfile profile = studentProfileRepository.findByUserId(user.id())
                    .filter(StudentProfile::hasResume)
                    .orElseThrow(() -> new ApiException(
                            HttpStatus.NOT_FOUND,
                            "Resume not found. Upload a PDF or paste your resume text first."
                    ));
            fileName = profile.getResumeFileName() != null ? profile.getResumeFileName() : "resume.pdf";
            try (PDDocument doc = Loader.loadPDF(profile.getResumeData())) {
                resumeText = new PDFTextStripper().getText(doc);
            } catch (IOException ex) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "The uploaded PDF could not be read.");
            }
            if (resumeText == null || resumeText.isBlank()) {
                throw new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "No readable text was found in the PDF. Please upload a text-based PDF or paste your resume text."
                );
            }
        }

        AiResumeAnalyzerClient analyzer = aiResumeAnalyzerClient != null
                ? aiResumeAnalyzerClient
                : new AiResumeAnalyzerClient(new ObjectMapper(), "", "gemini-2.5-flash");

        AnalysisResult result = analyzer.analyze(resumeText, jobDescription, targetRole);
        String cleanRole = trimToNull(targetRole);

        Long savedId = null;
        Instant createdAt = Instant.now();

        if (resumeAnalysisRepository != null) {
            ResumeAnalysisEntity entity = new ResumeAnalysisEntity(
                    user.id(),
                    cleanRole,
                    fileName,
                    result.overallScore(),
                    toJson(result.sectionScores()),
                    toJson(result.matchedSkills()),
                    toJson(result.missingSkills()),
                    toJson(result.suggestions()),
                    result.summary(),
                    result.aiPowered()
            );
            ResumeAnalysisEntity saved = resumeAnalysisRepository.save(entity);
            savedId = saved.getId();
            createdAt = saved.getCreatedAt();
        }

        return new ResumeAnalysis(
                savedId,
                cleanRole,
                fileName,
                result.overallScore(),
                result.sectionScores(),
                result.matchedSkills(),
                result.missingSkills(),
                result.suggestions(),
                result.summary(),
                result.aiPowered(),
                ANALYSIS_DISCLAIMER,
                createdAt
        );
    }

    @Transactional(readOnly = true)
    public List<ResumeAnalysis> listResumeAnalyses(AuthUser user) {
        if (resumeAnalysisRepository == null) {
            return List.of();
        }
        return resumeAnalysisRepository.findTop15ByUserIdOrderByCreatedAtDesc(user.id())
                .stream()
                .map(this::toResumeAnalysis)
                .toList();
    }

    @Transactional
    public void deleteResumeAnalysis(AuthUser user, Long analysisId) {
        if (resumeAnalysisRepository == null) {
            return;
        }
        ResumeAnalysisEntity entity = resumeAnalysisRepository.findByIdAndUserId(analysisId, user.id())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Analysis record not found."));
        resumeAnalysisRepository.delete(entity);
    }

    private ResumeAnalysis toResumeAnalysis(ResumeAnalysisEntity e) {
        SectionScores scores = fromJson(e.getSectionScoresJson(), new TypeReference<>() {}, new SectionScores(0, 0, 0, 0));
        List<String> matched = fromJson(e.getMatchedSkillsJson(), new TypeReference<>() {}, new ArrayList<>());
        List<String> missing = fromJson(e.getMissingSkillsJson(), new TypeReference<>() {}, new ArrayList<>());
        List<ResumeSuggestion> suggestions = fromJson(e.getSuggestionsJson(), new TypeReference<>() {}, new ArrayList<>());
        return new ResumeAnalysis(
                e.getId(),
                e.getTargetRole(),
                e.getResumeFileName(),
                e.getOverallScore(),
                scores,
                matched,
                missing,
                suggestions,
                e.getSummary(),
                e.isAiPowered(),
                ANALYSIS_DISCLAIMER,
                e.getCreatedAt()
        );
    }

    private String toJson(Object value) {
        try {
            ObjectMapper mapper = objectMapper != null ? objectMapper : new ObjectMapper();
            return mapper.writeValueAsString(value);
        } catch (Exception ex) {
            return "[]";
        }
    }

    private <T> T fromJson(String raw, TypeReference<T> type, T fallback) {
        if (raw == null || raw.isBlank()) return fallback;
        try {
            ObjectMapper mapper = objectMapper != null ? objectMapper : new ObjectMapper();
            return mapper.readValue(raw, type);
        } catch (Exception ex) {
            return fallback;
        }
    }

    private StudentRegistry findRegistryByUser(Long userId) {
        return registryRepository.findAll().stream()
                .filter(r -> userId.equals(r.getClaimedUserId()))
                .findFirst()
                .orElse(null);
    }

    private BigDecimal computeEquivalentPercentage(BigDecimal cgpa, BigDecimal fallback) {
        if (cgpa == null) return fallback;
        BigDecimal pct = cgpa.subtract(new BigDecimal("0.75")).multiply(BigDecimal.TEN);
        if (pct.compareTo(BigDecimal.ZERO) < 0) pct = BigDecimal.ZERO;
        if (pct.compareTo(new BigDecimal("100")) > 0) pct = new BigDecimal("100");
        return pct.setScale(2, RoundingMode.HALF_UP);
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}