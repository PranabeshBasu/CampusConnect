package com.campusconnect.student;

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
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/admin/students/registry")
@PreAuthorize("hasRole('PLACEMENT_ADMIN')")
public class BulkRegistryImportController {

    public record ImportResult(int created, int skipped, List<String> errors) {}

    private final StudentRegistryRepository registry;

    public BulkRegistryImportController(StudentRegistryRepository registry) {
        this.registry = registry;
    }

    @GetMapping
    public List<StudentRegistry> list() {
        return registry.findAll();
    }

    @PostMapping("/import")
    @Transactional
    public ImportResult importCsv(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Choose a non-empty CSV file.");
        }

        int created = 0;
        int skipped = 0;
        List<String> errors = new ArrayList<>();
        Set<String> seenEnroll = new HashSet<>();
        List<StudentRegistry> batch = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {

            String line;
            int rowNum = 0;
            while ((line = reader.readLine()) != null) {
                rowNum++;
                if (line.trim().isEmpty()) continue;

                List<String> cols = parseCsvLine(line);
                if (rowNum == 1 && isHeader(cols)) continue;

                String name = col(cols, 0);
                String enrollmentNo = col(cols, 1);
                String registrationNo = col(cols, 2);
                String department = col(cols, 3);
                String stream = col(cols, 4);
                String gradYearStr = col(cols, 5);

                if (name == null || enrollmentNo == null || registrationNo == null
                        || department == null || stream == null) {
                    errors.add("Row " + rowNum + ": Name, Enrollment No, Registration No, Department, and Stream are required.");
                    skipped++;
                    continue;
                }

                Short gradYear = null;
                if (gradYearStr != null) {
                    try {
                        gradYear = Short.parseShort(gradYearStr);
                    } catch (NumberFormatException ex) {
                        errors.add("Row " + rowNum + ": invalid graduation year (" + gradYearStr + ").");
                        skipped++;
                        continue;
                    }
                }

                String key = enrollmentNo.toLowerCase(Locale.ROOT);
                if (!seenEnroll.add(key)
                        || registry.existsByEnrollmentNoIgnoreCase(enrollmentNo)
                        || registry.existsByRegistrationNoIgnoreCase(registrationNo)) {
                    skipped++;
                    continue;
                }

                batch.add(new StudentRegistry(enrollmentNo, registrationNo, name, department, stream, gradYear));
                created++;

                if (batch.size() >= 500) {
                    registry.saveAll(batch);
                    batch.clear();
                }
            }
            if (!batch.isEmpty()) {
                registry.saveAll(batch);
            }
        } catch (IOException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Could not read CSV file.");
        }

        return new ImportResult(created, skipped, errors);
    }

    private static boolean isHeader(List<String> cols) {
        if (cols.isEmpty()) return false;
        String first = cols.get(0).trim().toLowerCase(Locale.ROOT).replace("\uFEFF", "");
        return "name".equals(first) || "full_name".equals(first) || "student_name".equals(first);
    }

    private static String col(List<String> cols, int idx) {
        if (idx >= cols.size()) return null;
        String v = cols.get(idx).trim().replace("\uFEFF", "");
        return v.isEmpty() ? null : v;
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