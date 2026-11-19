package com.campusconnect.application;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class ApplicationDtos {
    private ApplicationDtos() {}

    public record StatusRequest(@NotNull ApplicationStatus status, @Size(max = 500) String note) {}

    public record RoundProgressItem(
            Long roundId,
            Integer sequenceNumber,
            String name,
            Instant scheduledAt,
            String venue,
            String roundStatus,
            String outcome,
            String feedback) {}

    /** What a student sees about their own application. */
    public record ApplicationResponse(
            Long id,
            Long driveId,
            String companyName,
            String driveTitle,
            ApplicationStatus status,
            Instant appliedAt,
            Instant updatedAt,
            Instant applicationDeadline,
            List<RoundProgressItem> rounds) {

        public ApplicationResponse(
                Long id,
                Long driveId,
                String companyName,
                String driveTitle,
                ApplicationStatus status,
                Instant appliedAt,
                Instant updatedAt,
                Instant applicationDeadline) {
            this(id, driveId, companyName, driveTitle, status, appliedAt, updatedAt, applicationDeadline, List.of());
        }
    }

    /** What an administrator or the student's department SPOC sees. */
    public record ApplicationRow(Long id, Long driveId, String companyName, String driveTitle, Long studentUserId,
                                 String studentName, String studentEmail, String branch, Integer graduationYear,
                                 BigDecimal cgpa, ApplicationStatus status, Instant appliedAt) {}
}