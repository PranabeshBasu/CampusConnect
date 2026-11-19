CREATE TABLE IF NOT EXISTS student_registry (
    id              BIGSERIAL PRIMARY KEY,
    enrollment_no   VARCHAR(64)  NOT NULL UNIQUE,
    registration_no VARCHAR(64)  NOT NULL UNIQUE,
    full_name       VARCHAR(160) NOT NULL,
    department      VARCHAR(120) NOT NULL,
    stream          VARCHAR(120) NOT NULL,
    graduation_year SMALLINT,
    claimed_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    imported_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_registry_enrollment ON student_registry (enrollment_no);

ALTER TABLE student_profiles
    ADD COLUMN IF NOT EXISTS enrollment_no         VARCHAR(64),
    ADD COLUMN IF NOT EXISTS registration_no       VARCHAR(64),
    ADD COLUMN IF NOT EXISTS department            VARCHAR(120),
    ADD COLUMN IF NOT EXISTS stream                VARCHAR(120),
    ADD COLUMN IF NOT EXISTS section               VARCHAR(20),
    ADD COLUMN IF NOT EXISTS personal_email        VARCHAR(255),
    ADD COLUMN IF NOT EXISTS tenth_percentage      NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS tenth_subjects_json   TEXT,
    ADD COLUMN IF NOT EXISTS twelfth_percentage    NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS twelfth_subjects_json TEXT,
    ADD COLUMN IF NOT EXISTS completed_semesters   SMALLINT,
    ADD COLUMN IF NOT EXISTS semester_sgpas_json   TEXT,
    ADD COLUMN IF NOT EXISTS ygpa_json             TEXT,
    ADD COLUMN IF NOT EXISTS equivalent_percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS father_name           VARCHAR(160),
    ADD COLUMN IF NOT EXISTS father_phone          VARCHAR(30),
    ADD COLUMN IF NOT EXISTS mother_name           VARCHAR(160),
    ADD COLUMN IF NOT EXISTS mother_phone          VARCHAR(30),
    ADD COLUMN IF NOT EXISTS parent_email          VARCHAR(255),
    ADD COLUMN IF NOT EXISTS address_line1         VARCHAR(255),
    ADD COLUMN IF NOT EXISTS address_line2         VARCHAR(255),
    ADD COLUMN IF NOT EXISTS city                  VARCHAR(120),
    ADD COLUMN IF NOT EXISTS district              VARCHAR(120),
    ADD COLUMN IF NOT EXISTS state                 VARCHAR(120),
    ADD COLUMN IF NOT EXISTS pin_code              VARCHAR(12);

CREATE TABLE IF NOT EXISTS student_documents (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doc_type     VARCHAR(40)  NOT NULL,
    file_name    VARCHAR(255) NOT NULL,
    content_type VARCHAR(120) NOT NULL,
    size_bytes   BIGINT       NOT NULL,
    storage_key  VARCHAR(512) NOT NULL,
    uploaded_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, doc_type)
);

CREATE INDEX IF NOT EXISTS idx_student_documents_user ON student_documents (user_id);