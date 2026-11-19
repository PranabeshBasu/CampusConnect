package com.campusconnect.student;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "resume_analyses")
public class ResumeAnalysisEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "target_role", length = 160)
    private String targetRole;

    @Column(name = "resume_file_name", length = 255)
    private String resumeFileName;

    @Column(name = "overall_score", nullable = false)
    private int overallScore;

    @Column(name = "section_scores_json", nullable = false, columnDefinition = "TEXT")
    private String sectionScoresJson;

    @Column(name = "matched_skills_json", nullable = false, columnDefinition = "TEXT")
    private String matchedSkillsJson;

    @Column(name = "missing_skills_json", nullable = false, columnDefinition = "TEXT")
    private String missingSkillsJson;

    @Column(name = "suggestions_json", nullable = false, columnDefinition = "TEXT")
    private String suggestionsJson;

    @Column(columnDefinition = "TEXT")
    private String summary;

    @Column(name = "ai_powered", nullable = false)
    private boolean aiPowered;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected ResumeAnalysisEntity() {
    }

    public ResumeAnalysisEntity(
            Long userId,
            String targetRole,
            String resumeFileName,
            int overallScore,
            String sectionScoresJson,
            String matchedSkillsJson,
            String missingSkillsJson,
            String suggestionsJson,
            String summary,
            boolean aiPowered) {
        this.userId = userId;
        this.targetRole = targetRole;
        this.resumeFileName = resumeFileName;
        this.overallScore = overallScore;
        this.sectionScoresJson = sectionScoresJson;
        this.matchedSkillsJson = matchedSkillsJson;
        this.missingSkillsJson = missingSkillsJson;
        this.suggestionsJson = suggestionsJson;
        this.summary = summary;
        this.aiPowered = aiPowered;
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getTargetRole() {
        return targetRole;
    }

    public String getResumeFileName() {
        return resumeFileName;
    }

    public int getOverallScore() {
        return overallScore;
    }

    public String getSectionScoresJson() {
        return sectionScoresJson;
    }

    public String getMatchedSkillsJson() {
        return matchedSkillsJson;
    }

    public String getMissingSkillsJson() {
        return missingSkillsJson;
    }

    public String getSuggestionsJson() {
        return suggestionsJson;
    }

    public String getSummary() {
        return summary;
    }

    public boolean isAiPowered() {
        return aiPowered;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}