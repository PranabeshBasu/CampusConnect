package com.campusconnect.student;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class AiResumeAnalyzerClient {

    private static final Logger log = LoggerFactory.getLogger(AiResumeAnalyzerClient.class);
    private static final Pattern METRIC_PATTERN = Pattern.compile("\\b\\d+(?:\\.\\d+)?(?:%|\\+|x|ms|s|k|m)?\\b");

    private static final Map<String, List<String>> SKILL_SYNONYMS = new LinkedHashMap<>();
    static {
        SKILL_SYNONYMS.put("Java", List.of("java", "jdk", "jvm"));
        SKILL_SYNONYMS.put("Spring Boot", List.of("spring boot", "spring", "spring security", "spring data"));
        SKILL_SYNONYMS.put("Python", List.of("python", "fastapi", "flask", "django"));
        SKILL_SYNONYMS.put("JavaScript / TypeScript", List.of("javascript", "typescript", "es6", "node.js", "nodejs"));
        SKILL_SYNONYMS.put("React", List.of("react", "reactjs", "react.js", "next.js", "nextjs"));
        SKILL_SYNONYMS.put("SQL / PostgreSQL", List.of("sql", "postgresql", "postgres", "mysql", "rdbms"));
        SKILL_SYNONYMS.put("REST APIs", List.of("rest", "restful", "api", "microservices"));
        SKILL_SYNONYMS.put("Data Structures & Algorithms", List.of("data structures", "algorithms", "dsa", "leetcode"));
        SKILL_SYNONYMS.put("Git & CI/CD", List.of("git", "github", "gitlab", "ci/cd", "github actions"));
        SKILL_SYNONYMS.put("Docker & Cloud", List.of("docker", "kubernetes", "aws", "gcp", "azure", "cloud"));
        SKILL_SYNONYMS.put("Machine Learning / AI", List.of("machine learning", "deep learning", "nlp", "scikit-learn", "tensorflow", "pytorch"));
    }

    public record SectionScores(int skills, int projects, int impact, int clarity) {
    }

    public record ResumeSuggestion(String section, String priority, String advice, String exampleRewrite) {
    }

    public record AnalysisResult(
            int overallScore,
            SectionScores sectionScores,
            List<String> matchedSkills,
            List<String> missingSkills,
            List<ResumeSuggestion> suggestions,
            String summary,
            boolean aiPowered) {
    }

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;

    public AiResumeAnalyzerClient(
            ObjectMapper objectMapper,
            @Value("${app.ai.gemini-api-key:}") String apiKey,
            @Value("${app.ai.gemini-model:gemini-2.5-flash}") String model) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = (model == null || model.isBlank()) ? "gemini-2.5-flash" : model.trim();
    }

    public AnalysisResult analyze(String resumeText, String jobDescription, String targetRole) {
        if (!apiKey.isEmpty()) {
            try {
                return callGemini(resumeText, jobDescription, targetRole);
            } catch (Exception ex) {
                log.warn("Gemini resume analysis failed, using local fallback: {}", ex.getMessage());
            }
        }
        return analyzeLocally(resumeText, jobDescription, targetRole);
    }

    private AnalysisResult callGemini(String resumeText, String jobDescription, String targetRole) throws Exception {
        String safeResume = truncate(resumeText, 12000);
        String safeJd = truncate(jobDescription == null ? "" : jobDescription, 5000);
        String roleLabel = (targetRole == null || targetRole.isBlank()) ? "Software Engineer / Campus Placement Role" : targetRole.trim();

        String prompt = """
                You are an expert technical campus-placement ATS & resume coach.
                Analyze the student's resume against the target role and job description.
                Rules:
                - Never invent qualifications, metrics, or projects the student does not have.
                - Evaluate semantically (e.g., PostgreSQL satisfies SQL; Spring Boot satisfies Java backend).
                - Provide concrete, actionable rewrite examples based on their existing bullets.
                - Return ONLY valid JSON matching this exact schema:
                {
                  "overallScore": <int 0-100>,
                  "sectionScores": {
                    "skills": <int 0-100>,
                    "projects": <int 0-100>,
                    "impact": <int 0-100>,
                    "clarity": <int 0-100>
                  },
                  "matchedSkills": ["skill1", "skill2"],
                  "missingSkills": ["skill3", "skill4"],
                  "suggestions": [
                    {
                      "section": "Projects | Experience | Skills | Summary | Formatting",
                      "priority": "HIGH | MEDIUM | LOW",
                      "advice": "Concise actionable improvement",
                      "exampleRewrite": "Concrete before/after or improved bullet"
                    }
                  ],
                  "summary": "2-3 sentence honest assessment."
                }

                Target Role: %s
                Job Description:
                %s

                Resume Text:
                %s
                """.formatted(roleLabel, safeJd.isBlank() ? "(Not provided; evaluate against general SWE campus hiring standards)" : safeJd, safeResume);

        Map<String, Object> body = Map.of(
                "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))),
                "generationConfig", Map.of(
                        "temperature", 0.2,
                        "responseMimeType", "application/json"
                )
        );

        String url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(25))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                .build();

        HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            throw new IllegalStateException("Gemini HTTP " + resp.statusCode());
        }

        JsonNode root = objectMapper.readTree(resp.body());
        String rawJson = root.path("candidates").path(0).path("content").path("parts").path(0).path("text").asText("");
        if (rawJson.isBlank()) {
            throw new IllegalStateException("Empty Gemini response");
        }

        JsonNode parsed = objectMapper.readTree(stripCodeFence(rawJson));
        int overall = clamp(parsed.path("overallScore").asInt(70));
        JsonNode sec = parsed.path("sectionScores");
        SectionScores sectionScores = new SectionScores(
                clamp(sec.path("skills").asInt(overall)),
                clamp(sec.path("projects").asInt(overall)),
                clamp(sec.path("impact").asInt(overall)),
                clamp(sec.path("clarity").asInt(overall))
        );

        List<String> matched = toStringList(parsed.path("matchedSkills"));
        List<String> missing = toStringList(parsed.path("missingSkills"));
        List<ResumeSuggestion> suggestions = new ArrayList<>();
        for (JsonNode s : parsed.path("suggestions")) {
            suggestions.add(new ResumeSuggestion(
                    s.path("section").asText("General"),
                    s.path("priority").asText("MEDIUM"),
                    s.path("advice").asText(""),
                    s.path("exampleRewrite").asText("")
            ));
        }

        String summary = parsed.path("summary").asText("Analysis complete.");
        return new AnalysisResult(overall, sectionScores, matched, missing, suggestions, summary, true);
    }

    private AnalysisResult analyzeLocally(String resumeText, String jobDescription, String targetRole) {
        String normResume = resumeText.toLowerCase(Locale.ROOT);
        String normJd = (jobDescription == null ? "" : jobDescription).toLowerCase(Locale.ROOT);

        List<String> targetGroups = new ArrayList<>();
        for (Map.Entry<String, List<String>> entry : SKILL_SYNONYMS.entrySet()) {
            if (normJd.isBlank() || entry.getValue().stream().anyMatch(normJd::contains)) {
                targetGroups.add(entry.getKey());
            }
        }
        if (targetGroups.isEmpty()) {
            targetGroups.addAll(SKILL_SYNONYMS.keySet());
        }

        List<String> matched = new ArrayList<>();
        List<String> missing = new ArrayList<>();
        for (String group : targetGroups) {
            boolean found = SKILL_SYNONYMS.get(group).stream().anyMatch(normResume::contains);
            if (found) matched.add(group);
            else missing.add(group);
        }

        int skillsScore = targetGroups.isEmpty() ? 70 : clamp((int) Math.round((matched.size() * 100.0) / targetGroups.size()));

        boolean hasProjects = normResume.contains("project");
        boolean hasEducation = normResume.contains("education") || normResume.contains("b.tech") || normResume.contains("cgpa");
        boolean hasSkillsSec = normResume.contains("skill");
        int projectsScore = hasProjects ? (normResume.length() > 800 ? 84 : 72) : 45;

        int metricHits = 0;
        Matcher m = METRIC_PATTERN.matcher(resumeText);
        while (m.find()) metricHits++;
        int impactScore = clamp(45 + Math.min(metricHits, 10) * 5);

        int clarityScore = clamp((hasEducation ? 30 : 15) + (hasSkillsSec ? 30 : 15) + (hasProjects ? 25 : 10) + (resumeText.length() >= 600 ? 15 : 5));
        int overall = clamp((int) Math.round(skillsScore * 0.40 + projectsScore * 0.25 + impactScore * 0.20 + clarityScore * 0.15));

        List<ResumeSuggestion> suggestions = new ArrayList<>();
        if (!missing.isEmpty()) {
            suggestions.add(new ResumeSuggestion(
                    "Skills",
                    "HIGH",
                    "Add or highlight relevant target skills you have used: " + String.join(", ", missing.subList(0, Math.min(4, missing.size()))) + ".",
                    "Technical Skills: " + String.join(", ", matched.subList(0, Math.min(3, matched.size()))) + ", " + missing.get(0)
            ));
        }
        if (impactScore < 75) {
            suggestions.add(new ResumeSuggestion(
                    "Impact",
                    "HIGH",
                    "Quantify project outcomes with concrete numbers (latency, users, accuracy, or test coverage).",
                    "Reduced API response latency by 35% by indexing PostgreSQL queries and caching lookup results."
            ));
        }
        if (!hasProjects) {
            suggestions.add(new ResumeSuggestion(
                    "Projects",
                    "MEDIUM",
                    "Include a dedicated Projects section with 2-3 technical builds, tech stack, and measurable results.",
                    "CampusConnect Placement Portal (Spring Boot, React, PostgreSQL) — Built RBAC APIs serving 500+ students."
            ));
        }

        String roleNote = (targetRole == null || targetRole.isBlank()) ? "target role" : targetRole.trim();
        String summary = String.format(
                "Local semantic & structure analysis for %s: matched %d of %d key skill areas (%d%% overall). Configure GEMINI_API_KEY for full LLM rewrite coaching.",
                roleNote, matched.size(), targetGroups.size(), overall
        );

        return new AnalysisResult(
                overall,
                new SectionScores(skillsScore, projectsScore, impactScore, clarityScore),
                matched,
                missing,
                suggestions,
                summary,
                false
        );
    }

    private List<String> toStringList(JsonNode arrayNode) {
        List<String> out = new ArrayList<>();
        if (arrayNode != null && arrayNode.isArray()) {
            for (JsonNode n : arrayNode) {
                String v = n.asText("").trim();
                if (!v.isEmpty()) out.add(v);
            }
        }
        return out;
    }

    private String stripCodeFence(String text) {
        String s = text.trim();
        if (s.startsWith("```")) {
            int firstNewline = s.indexOf('\n');
            if (firstNewline > 0) s = s.substring(firstNewline + 1);
            if (s.endsWith("```")) s = s.substring(0, s.length() - 3);
        }
        return s.trim();
    }

    private String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max);
    }

    private int clamp(int v) {
        return Math.max(0, Math.min(100, v));
    }
}
