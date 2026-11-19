package com.campusconnect.student;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ResumeAnalysisRepository extends JpaRepository<ResumeAnalysisEntity, Long> {

    List<ResumeAnalysisEntity> findTop15ByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<ResumeAnalysisEntity> findByIdAndUserId(Long id, Long userId);
}