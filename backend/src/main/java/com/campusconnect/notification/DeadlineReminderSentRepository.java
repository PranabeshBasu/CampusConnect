package com.campusconnect.notification;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DeadlineReminderSentRepository extends JpaRepository<DeadlineReminderSent, DeadlineReminderSent.Key> {
    boolean existsByDriveIdAndUserId(Long driveId, Long userId);
}
