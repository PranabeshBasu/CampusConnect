package com.campusconnect.company;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;

public final class CompanyDtos {

    private CompanyDtos() {}

    public record CompanyRequest(
            @NotBlank
            @Size(max = 160)
            String name,

            @Size(max = 2048)
            @Pattern(
                    regexp = "^(https?://\\S+)?$",
                    message = "Website must be a valid HTTP or HTTPS URL."
            )
            String website,

            @Size(max = 2000)
            String description,

            @Size(max = 120)
            String industry,

            @Size(max = 2048)
            @Pattern(
                    regexp = "^(https?://\\S+)?$",
                    message = "Logo URL must be a valid HTTP or HTTPS URL."
            )
            String logoUrl) {

        public CompanyRequest(String name, String website, String description, String industry) {
            this(name, website, description, industry, null);
        }
    }

    public record CompanyResponse(
            Long id,
            String name,
            String website,
            String logoUrl,
            String description,
            String industry,
            boolean active,
            Instant createdAt,
            Instant updatedAt) {

        public CompanyResponse(
                Long id,
                String name,
                String website,
                String description,
                String industry,
                boolean active,
                Instant createdAt,
                Instant updatedAt) {
            this(id, name, website, null, description, industry, active, createdAt, updatedAt);
        }

        public static CompanyResponse from(Company company) {
            return new CompanyResponse(
                    company.getId(),
                    company.getName(),
                    company.getWebsite(),
                    company.getLogoUrl(),
                    company.getDescription(),
                    company.getIndustry(),
                    company.isActive(),
                    company.getCreatedAt(),
                    company.getUpdatedAt());
        }
    }
}