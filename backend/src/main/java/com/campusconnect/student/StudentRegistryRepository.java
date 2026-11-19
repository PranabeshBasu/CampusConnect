package com.campusconnect.student;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudentRegistryRepository extends JpaRepository<StudentRegistry, Long> {
    Optional<StudentRegistry> findByEnrollmentNoIgnoreCase(String enrollmentNo);
    boolean existsByEnrollmentNoIgnoreCase(String enrollmentNo);
    boolean existsByRegistrationNoIgnoreCase(String registrationNo);
}
