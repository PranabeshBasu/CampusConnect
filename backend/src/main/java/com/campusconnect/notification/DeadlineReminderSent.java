package com.campusconnect.notification;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.Instant;

@Entity
@Table(name = "deadline_reminders_sent")
@IdClass(DeadlineReminderSent.Key.class)
public class DeadlineReminderSent {

    public static class Key implements Serializable {
        public Long driveId;
        public Long userId;
        public Key() {}
        public Key(Long driveId, Long userId) { this.driveId = driveId; this.userId = userId; }
        @Override public boolean equals(Object o) {
            if (!(o instanceof Key k)) return false;
            return java.util.Objects.equals(driveId, k.driveId) && java.util.Objects.equals(userId, k.userId);
        }
        @Override public int hashCode() { return java.util.Objects.hash(driveId, userId); }
    }

    @Id @Column(name = "drive_id") private Long driveId;
    @Id @Column(name = "user_id") private Long userId;
    @Column(name = "sent_at", nullable = false) private Instant sentAt;

    protected DeadlineReminderSent() {}
    public DeadlineReminderSent(Long driveId, Long userId) {
        this.driveId = driveId;
        this.userId = userId;
        this.sentAt = Instant.now();
    }
}