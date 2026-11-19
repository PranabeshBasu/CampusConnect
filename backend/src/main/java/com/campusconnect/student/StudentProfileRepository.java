package com.campusconnect.student;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudentProfileRepository extends JpaRepository<StudentProfile, Long> {

    Optional<StudentProfile> findByUserId(Long userId);

    Optional<StudentProfile> findByPersonalEmailIgnoreCase(String personalEmail);

    boolean existsByRollNumberIgnoreCase(String rollNumber);

    List<StudentProfile> findByUserIdIn(Collection<Long> userIds);

    /** Students whose profile has the two fields every eligibility check needs. */
    long countByGraduationYearIsNotNullAndCgpaIsNotNull();
}