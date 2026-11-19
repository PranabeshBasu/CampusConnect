package com.campusconnect.student;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "student_profiles")
public class StudentProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(name = "roll_number", length = 40, unique = true)
    private String rollNumber;

    @Column(length = 20)
    private String phone;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(length = 100)
    private String degree;

    @Column(length = 120)
    private String branch;

    @Column(name = "graduation_year")
    private Short graduationYear;

    @Column(precision = 4, scale = 2)
    private BigDecimal cgpa;

    @Column(name = "active_backlogs", nullable = false)
    private Short activeBacklogs = 0;

    // Registry & extended identity
    @Column(name = "enrollment_no", length = 64)
    private String enrollmentNo;

    @Column(name = "registration_no", length = 64)
    private String registrationNo;

    @Column(length = 120)
    private String department;

    @Column(length = 120)
    private String stream;

    @Column(length = 20)
    private String section;

    @Column(name = "personal_email", length = 255)
    private String personalEmail;

    // 10th & 12th marks
    @Column(name = "tenth_percentage", precision = 5, scale = 2)
    private BigDecimal tenthPercentage;

    @Column(name = "tenth_subjects_json", columnDefinition = "TEXT")
    private String tenthSubjectsJson;

    @Column(name = "twelfth_percentage", precision = 5, scale = 2)
    private BigDecimal twelfthPercentage;

    @Column(name = "twelfth_subjects_json", columnDefinition = "TEXT")
    private String twelfthSubjectsJson;

    // Semester SGPAs, YGPAs & equivalent percentage
    @Column(name = "completed_semesters")
    private Short completedSemesters;

    @Column(name = "semester_sgpas_json", columnDefinition = "TEXT")
    private String semesterSgpasJson;

    @Column(name = "ygpa_json", columnDefinition = "TEXT")
    private String ygpaJson;

    @Column(name = "equivalent_percentage", precision = 5, scale = 2)
    private BigDecimal equivalentPercentage;

    // Parent / guardian details
    @Column(name = "father_name", length = 160)
    private String fatherName;

    @Column(name = "father_phone", length = 30)
    private String fatherPhone;

    @Column(name = "mother_name", length = 160)
    private String motherName;

    @Column(name = "mother_phone", length = 30)
    private String motherPhone;

    @Column(name = "parent_email", length = 255)
    private String parentEmail;

    // Structured address
    @Column(name = "address_line1", length = 255)
    private String addressLine1;

    @Column(name = "address_line2", length = 255)
    private String addressLine2;

    @Column(length = 120)
    private String city;

    @Column(length = 120)
    private String district;

    @Column(length = 120)
    private String state;

    @Column(name = "pin_code", length = 12)
    private String pinCode;

    // Legacy resume URL retained for compatibility
    @Column(name = "resume_url", length = 2048)
    private String resumeUrl;

    // Resume PDF storage
    @Column(name = "resume_file_name")
    private String resumeFileName;

    @Column(name = "resume_content_type")
    private String resumeContentType;

    @Column(name = "resume_data")
    private byte[] resumeData;

    @Column(name = "resume_uploaded_at")
    private Instant resumeUploadedAt;

    // SPOC verification & academic lock
    @Column(nullable = false)
    private boolean verified = false;

    @Column(name = "verified_by")
    private Long verifiedBy;

    @Column(name = "verified_at")
    private Instant verifiedAt;

    @Column(name = "verification_note", length = 500)
    private String verificationNote;

    protected StudentProfile() {
    }

    public StudentProfile(Long userId) {
        this.userId = userId;
        this.activeBacklogs = 0;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getRollNumber() { return rollNumber; }
    public String getPhone() { return phone; }
    public LocalDate getDateOfBirth() { return dateOfBirth; }
    public String getDegree() { return degree; }
    public String getBranch() { return branch; }
    public Short getGraduationYear() { return graduationYear; }
    public BigDecimal getCgpa() { return cgpa; }
    public Short getActiveBacklogs() { return activeBacklogs; }
    public String getEnrollmentNo() { return enrollmentNo; }
    public String getRegistrationNo() { return registrationNo; }
    public String getDepartment() { return department; }
    public String getStream() { return stream; }
    public String getSection() { return section; }
    public String getPersonalEmail() { return personalEmail; }
    public BigDecimal getTenthPercentage() { return tenthPercentage; }
    public String getTenthSubjectsJson() { return tenthSubjectsJson; }
    public BigDecimal getTwelfthPercentage() { return twelfthPercentage; }
    public String getTwelfthSubjectsJson() { return twelfthSubjectsJson; }
    public Short getCompletedSemesters() { return completedSemesters; }
    public String getSemesterSgpasJson() { return semesterSgpasJson; }
    public String getYgpaJson() { return ygpaJson; }
    public BigDecimal getEquivalentPercentage() { return equivalentPercentage; }
    public String getFatherName() { return fatherName; }
    public String getFatherPhone() { return fatherPhone; }
    public String getMotherName() { return motherName; }
    public String getMotherPhone() { return motherPhone; }
    public String getParentEmail() { return parentEmail; }
    public String getAddressLine1() { return addressLine1; }
    public String getAddressLine2() { return addressLine2; }
    public String getCity() { return city; }
    public String getDistrict() { return district; }
    public String getState() { return state; }
    public String getPinCode() { return pinCode; }
    public String getResumeUrl() { return resumeUrl; }
    public String getResumeFileName() { return resumeFileName; }
    public String getResumeContentType() { return resumeContentType; }
    public byte[] getResumeData() { return resumeData; }
    public Instant getResumeUploadedAt() { return resumeUploadedAt; }
    public boolean isVerified() { return verified; }
    public Long getVerifiedBy() { return verifiedBy; }
    public Instant getVerifiedAt() { return verifiedAt; }
    public String getVerificationNote() { return verificationNote; }

    public boolean hasResume() {
        return resumeData != null && resumeData.length > 0;
    }

    public void setVerification(boolean verified, Long spocUserId, String note) {
        this.verified = verified;
        this.verificationNote = (note != null && !note.isBlank()) ? note.trim() : null;
        if (verified) {
            this.verifiedBy = spocUserId;
            this.verifiedAt = Instant.now();
        } else {
            this.verifiedBy = null;
            this.verifiedAt = null;
        }
    }

    public void syncFromRegistry(StudentRegistry reg) {
        this.enrollmentNo = reg.getEnrollmentNo();
        this.registrationNo = reg.getRegistrationNo();
        this.department = reg.getDepartment();
        this.stream = reg.getStream();
        this.degree = reg.getDepartment();
        this.branch = reg.getStream();
        if (this.graduationYear == null && reg.getGraduationYear() != null) {
            this.graduationYear = reg.getGraduationYear();
        }
    }

    public void updateExtendedDetails(
            String section,
            String personalEmail,
            BigDecimal tenthPercentage,
            String tenthSubjectsJson,
            BigDecimal twelfthPercentage,
            String twelfthSubjectsJson,
            Short completedSemesters,
            String semesterSgpasJson,
            String ygpaJson,
            BigDecimal equivalentPercentage,
            String fatherName,
            String fatherPhone,
            String motherName,
            String motherPhone,
            String parentEmail,
            String addressLine1,
            String addressLine2,
            String city,
            String district,
            String state,
            String pinCode) {
        this.section = section;
        this.personalEmail = personalEmail;
        this.tenthPercentage = tenthPercentage;
        this.tenthSubjectsJson = tenthSubjectsJson;
        this.twelfthPercentage = twelfthPercentage;
        this.twelfthSubjectsJson = twelfthSubjectsJson;
        this.completedSemesters = completedSemesters;
        this.semesterSgpasJson = semesterSgpasJson;
        this.ygpaJson = ygpaJson;
        this.equivalentPercentage = equivalentPercentage;
        this.fatherName = fatherName;
        this.fatherPhone = fatherPhone;
        this.motherName = motherName;
        this.motherPhone = motherPhone;
        this.parentEmail = parentEmail;
        this.addressLine1 = addressLine1;
        this.addressLine2 = addressLine2;
        this.city = city;
        this.district = district;
        this.state = state;
        this.pinCode = pinCode;
    }

    public void storeResume(String fileName, String contentType, byte[] data) {
        this.resumeFileName = fileName;
        this.resumeContentType = contentType;
        this.resumeData = data;
        this.resumeUploadedAt = Instant.now();
        this.resumeUrl = null;
    }

    public void removeResume() {
        this.resumeFileName = null;
        this.resumeContentType = null;
        this.resumeData = null;
        this.resumeUploadedAt = null;
        this.resumeUrl = null;
    }

    public void updateDetails(
            String rollNumber,
            String phone,
            LocalDate dateOfBirth,
            String degree,
            String branch,
            Short graduationYear,
            BigDecimal cgpa,
            Short activeBacklogs,
            String resumeUrl) {

        this.rollNumber = rollNumber;
        this.phone = phone;
        this.dateOfBirth = dateOfBirth;
        this.degree = degree;
        this.branch = branch;
        this.graduationYear = graduationYear;
        this.cgpa = cgpa;
        this.activeBacklogs = activeBacklogs == null ? 0 : activeBacklogs;

        if (resumeData == null) {
            this.resumeUrl = resumeUrl;
        }
    }
}