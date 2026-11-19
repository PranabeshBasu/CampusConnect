CREATE TABLE resume_analyses (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    target_role VARCHAR(160),
    resume_file_name VARCHAR(255),
    overall_score INT NOT NULL,
    section_scores_json TEXT NOT NULL,
    matched_skills_json TEXT NOT NULL,
    missing_skills_json TEXT NOT NULL,
    suggestions_json TEXT NOT NULL,
    summary TEXT,
    ai_powered BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resume_analyses_user_created
    ON resume_analyses (user_id, created_at DESC);