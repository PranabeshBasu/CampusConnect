CREATE TABLE notifications (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title       VARCHAR(160) NOT NULL,
    message     VARCHAR(500) NOT NULL,
    type        VARCHAR(32)  NOT NULL,
    link        VARCHAR(255),
    is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ix_notifications_user_created ON notifications (user_id, created_at DESC);

CREATE TABLE deadline_reminders_sent (
    drive_id  BIGINT NOT NULL REFERENCES placement_drives (id) ON DELETE CASCADE,
    user_id   BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    sent_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (drive_id, user_id)
);