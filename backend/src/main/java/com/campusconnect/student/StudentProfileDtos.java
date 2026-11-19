package com.campusconnect.student;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public final class StudentProfileDtos {

    private StudentProfileDtos() {
    }

    public record UpdateStudentProfileRequest(
            @Size(max = 40) String rollNumber,
            @Size(max = 20) String phone,
            @Past LocalDate dateOfBirth,
            @Size(max = 100) String degree,
            @Size(max = 120) String branch,
            @Min(2000) @Max(2100) Short graduationYear,
            @DecimalMin("0.00") @DecimalMax("10.00") BigDecimal cgpa,
            @PositiveOrZero Short activeBacklogs,
            @Size(max = 2048) String resumeUrl,
            @Size(max = 20) String section,
            @Email @Size(max = 255) String personalEmail,
            @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal tenthPercentage,
            String tenthSubjectsJson,
            @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal twelfthPercentage,
            String twelfthSubjectsJson,
            @Min(0) @Max(12) Short completedSemesters,
            String semesterSgpasJson,
            String ygpaJson,
            @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal equivalentPercentage,
            @Size(max = 160) String fatherName,
            @Size(max = 30) String fatherPhone,
            @Size(max = 160) String motherName,
            @Size(max = 30) String motherPhone,
            @Email @Size(max = 255) String parentEmail,
            @Size(max = 255) String addressLine1,
            @Size(max = 255) String addressLine2,
            @Size(max = 120) String city,
            @Size(max = 120) String district,
            @Size(max = 120) String state,
            @Size(max = 12) String pinCode
    ) {
        public UpdateStudentProfileRequest(
                String rollNumber,
                String phone,
                LocalDate dateOfBirth,
                String degree,
                String branch,
                Short graduationYear,
                BigDecimal cgpa,
                Short activeBacklogs,
                String resumeUrl
        ) {
            this(rollNumber, phone, dateOfBirth, degree, branch, graduationYear, cgpa, activeBacklogs, resumeUrl,
                    null, null, null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null, null, null, null);
        }
    }

    public record StudentProfileResponse(
            Long id,
            Long userId,
            String rollNumber,
            String phone,
            LocalDate dateOfBirth,
            String degree,
            String branch,
            Short graduationYear,
            BigDecimal cgpa,
            Short activeBacklogs,
            String resumeUrl,
            boolean verified,
            Instant verifiedAt,
            String verificationNote,
            String enrollmentNo,
            String registrationNo,
            String department,
            String stream,
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
            String pinCode
    ) {
        public StudentProfileResponse(
                Long id, Long userId, String rollNumber, String phone, LocalDate dateOfBirth,
                String degree, String branch, Short graduationYear, BigDecimal cgpa,
                Short activeBacklogs, String resumeUrl
        ) {
            this(id, userId, rollNumber, phone, dateOfBirth, degree, branch, graduationYear, cgpa, activeBacklogs, resumeUrl,
                    false, null, null);
        }

        public StudentProfileResponse(
                Long id, Long userId, String rollNumber, String phone, LocalDate dateOfBirth,
                String degree, String branch, Short graduationYear, BigDecimal cgpa,
                Short activeBacklogs, String resumeUrl, boolean verified, Instant verifiedAt, String verificationNote
        ) {
            this(id, userId, rollNumber, phone, dateOfBirth, degree, branch, graduationYear, cgpa, activeBacklogs, resumeUrl,
                    verified, verifiedAt, verificationNote,
                    null, null, null, null, null, null, null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null, null, null, null);
        }

        public static StudentProfileResponse from(StudentProfile p) {
            return new StudentProfileResponse(
                    p.getId(),
                    p.getUserId(),
                    p.getRollNumber(),
                    p.getPhone(),
                    p.getDateOfBirth(),
                    p.getDegree(),
                    p.getBranch(),
                    p.getGraduationYear(),
                    p.getCgpa(),
                    p.getActiveBacklogs(),
                    p.getResumeUrl(),
                    p.isVerified(),
                    p.getVerifiedAt(),
                    p.getVerificationNote(),
                    p.getEnrollmentNo(),
                    p.getRegistrationNo(),
                    p.getDepartment(),
                    p.getStream(),
                    p.getSection(),
                    p.getPersonalEmail(),
                    p.getTenthPercentage(),
                    p.getTenthSubjectsJson(),
                    p.getTwelfthPercentage(),
                    p.getTwelfthSubjectsJson(),
                    p.getCompletedSemesters(),
                    p.getSemesterSgpasJson(),
                    p.getYgpaJson(),
                    p.getEquivalentPercentage(),
                    p.getFatherName(),
                    p.getFatherPhone(),
                    p.getMotherName(),
                    p.getMotherPhone(),
                    p.getParentEmail(),
                    p.getAddressLine1(),
                    p.getAddressLine2(),
                    p.getCity(),
                    p.getDistrict(),
                    p.getState(),
                    p.getPinCode()
            );
        }
    }
}