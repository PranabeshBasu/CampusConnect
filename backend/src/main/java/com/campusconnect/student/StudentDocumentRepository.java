package com.campusconnect.student;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudentDocumentRepository extends JpaRepository<StudentDocument, Long> {
    List<StudentDocument> findByUserId(Long userId);
    Optional<StudentDocument> findByUserIdAndDocType(Long userId, StudentDocumentType docType);
}