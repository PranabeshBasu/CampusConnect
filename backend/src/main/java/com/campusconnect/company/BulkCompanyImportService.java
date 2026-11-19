package com.campusconnect.company;

import com.campusconnect.common.ApiException;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class BulkCompanyImportService {

    public record ImportResult(int created, int skipped, List<String> errors) {}

    private final CompanyRepository companies;

    public BulkCompanyImportService(CompanyRepository companies) {
        this.companies = companies;
    }

    @Transactional
    public ImportResult importCsv(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Choose a non-empty CSV file.");
        }

        int created = 0;
        int skipped = 0;
        List<String> errors = new ArrayList<>();
        Set<String> seenInFile = new HashSet<>();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {

            String line;
            int rowNum = 0;

            while ((line = reader.readLine()) != null) {
                rowNum++;
                String trimmed = line.trim();
                if (trimmed.isEmpty()) {
                    continue;
                }

                List<String> cols = parseCsvLine(line);
                if (rowNum == 1 && isHeaderRow(cols)) {
                    continue;
                }

                String name = col(cols, 0);
                String website = normalizeWebsite(col(cols, 1));
                String industry = col(cols, 2);
                String description = col(cols, 3);

                if (name == null || name.isBlank()) {
                    errors.add("Row " + rowNum + ": company name is required.");
                    skipped++;
                    continue;
                }
                if (name.length() > 160) {
                    errors.add("Row " + rowNum + ": name exceeds 160 characters.");
                    skipped++;
                    continue;
                }
                if (website != null && !website.matches("^https?://\\S+$")) {
                    errors.add("Row " + rowNum + ": invalid website URL (" + website + ").");
                    skipped++;
                    continue;
                }

                String key = name.toLowerCase(Locale.ROOT);
                if (!seenInFile.add(key) || companies.existsByNameIgnoreCase(name)) {
                    skipped++;
                    continue;
                }

                companies.save(new Company(name, website, description, industry));
                created++;
            }
        } catch (IOException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Could not read CSV file.");
        }

        return new ImportResult(created, skipped, errors);
    }

    private static boolean isHeaderRow(List<String> cols) {
        if (cols.isEmpty()) return false;
        String first = cols.get(0).trim().toLowerCase(Locale.ROOT).replace("\uFEFF", "");
        return "name".equals(first) || "company".equals(first) || "company_name".equals(first);
    }

    private static String col(List<String> cols, int index) {
        if (index >= cols.size()) return null;
        String v = cols.get(index).trim().replace("\uFEFF", "");
        return v.isEmpty() ? null : v;
    }

    private static String normalizeWebsite(String raw) {
        if (raw == null || raw.isBlank()) return null;
        if (raw.matches("^https?://.*")) return raw;
        return "https://" + raw;
    }

    private static List<String> parseCsvLine(String line) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean inQuotes = false;

        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    cur.append('"');
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c == ',' && !inQuotes) {
                out.add(cur.toString());
                cur.setLength(0);
            } else {
                cur.append(c);
            }
        }
        out.add(cur.toString());
        return out;
    }
}