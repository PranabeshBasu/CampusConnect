ALTER TABLE student_profiles
    ADD COLUMN verified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN verified_by BIGINT REFERENCES users (id) ON DELETE SET NULL,
    ADD COLUMN verified_at TIMESTAMPTZ,
    ADD COLUMN verification_note VARCHAR(500);

CREATE INDEX ix_student_profiles_verified
    ON student_profiles (verified);