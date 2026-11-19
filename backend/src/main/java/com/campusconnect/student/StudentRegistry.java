package com.campusconnect.student;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "student_registry")
public class StudentRegistry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "enrollment_no", nullable = false, unique = true, length = 64)
    private String enrollmentNo;

    @Column(name = "registration_no", nullable = false, unique = true, length = 64)
    private String registrationNo;

    @Column(name = "full_name", nullable = false, length = 160)
    private String fullName;

    @Column(nullable = false, length = 120)
    private String department;

    @Column(nullable = false, length = 120)
    private String stream;

    @Column(name = "graduation_year")
    private Short graduationYear;

    @Column(name = "claimed_user_id")
    private Long claimedUserId;

    @Column(name = "imported_at", nullable = false)
    private Instant importedAt = Instant.now();

    protected StudentRegistry() {}

    public StudentRegistry(
            String enrollmentNo,
            String registrationNo,
            String fullName,
            String department,
            String stream,
            Short graduationYear) {
        this.enrollmentNo = enrollmentNo;
        this.registrationNo = registrationNo;
        this.fullName = fullName;
        this.department = department;
        this.stream = stream;
        this.graduationYear = graduationYear;
        this.importedAt = Instant.now();
    }

    public Long getId() { return id; }
    public String getEnrollmentNo() { return enrollmentNo; }
    public String getRegistrationNo() { return registrationNo; }
    public String getFullName() { return fullName; }
    public String getDepartment() { return department; }
    public String getStream() { return stream; }
    public Short getGraduationYear() { return graduationYear; }
    public Long getClaimedUserId() { return claimedUserId; }
    public Instant getImportedAt() { return importedAt; }

    public void setClaimedUserId(Long claimedUserId) { this.claimedUserId = claimedUserId; }
}