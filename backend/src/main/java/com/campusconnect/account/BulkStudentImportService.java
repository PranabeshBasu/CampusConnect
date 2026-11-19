package com.campusconnect.account;

import com.campusconnect.auth.Role;
import com.campusconnect.auth.UserAccount;
import com.campusconnect.auth.UserRepository;
import com.campusconnect.common.ApiException;
import com.campusconnect.department.Department;
import com.campusconnect.department.DepartmentRepository;
import com.campusconnect.student.StudentProfile;
import com.campusconnect.student.StudentProfileRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class BulkStudentImportService {

    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final PasswordEncoder passwordEncoder;

    public BulkStudentImportService(
            UserRepository userRepository,
            DepartmentRepository departmentRepository,
            StudentProfileRepository studentProfileRepository,
            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.departmentRepository = departmentRepository;
        this.studentProfileRepository = studentProfileRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public record RowError(int row, String email, String reason) {
    }

    public record ImportResult(
            int totalRows,
            int createdCount,
            int skippedCount,
            List<RowError> errors) {
    }

    @Transactional
    public ImportResult importCsv(MultipartFile file, String defaultPassword) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Please upload a non-empty CSV file.");
        }

        String rawPassword = (defaultPassword == null || defaultPassword.isBlank())
                ? "Campus@2027"
                : defaultPassword.trim();
        String encodedDefaultPassword = passwordEncoder.encode(rawPassword);

        Map<String, Long> deptIdByCode = new HashMap<>();
        for (Department dept : departmentRepository.findAll()) {
            deptIdByCode.put(dept.getCode().trim().toUpperCase(Locale.ROOT), dept.getId());
        }

        List<RowError> errors = new ArrayList<>();
        int totalRows = 0;
        int createdCount = 0;

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {

            String line;
            int lineNum = 0;
            while ((line = reader.readLine()) != null) {
                lineNum++;
                if (line.isBlank()) continue;

                List<String> cols = parseCsvLine(line);
                if (lineNum == 1 && isHeaderRow(cols)) {
                    continue;
                }

                totalRows++;
                String fullName = col(cols, 0);
                String email = col(cols, 1).toLowerCase(Locale.ROOT);
                String rollNumber = col(cols, 2);
                String deptCode = col(cols, 3).toUpperCase(Locale.ROOT);
                String branch = col(cols, 4);
                String gradYearStr = col(cols, 5);
                String cgpaStr = col(cols, 6);
                String backlogsStr = col(cols, 7);

                if (fullName.isBlank()) {
                    errors.add(new RowError(lineNum, email, "Missing fullName."));
                    continue;
                }
                if (email.isBlank() || !email.contains("@")) {
                    errors.add(new RowError(lineNum, email, "Invalid or missing email."));
                    continue;
                }
                if (userRepository.existsByEmail(email)) {
                    errors.add(new RowError(lineNum, email, "Email already registered."));
                    continue;
                }
                if (!rollNumber.isBlank() && studentProfileRepository.existsByRollNumberIgnoreCase(rollNumber)) {
                    errors.add(new RowError(lineNum, email, "Roll number already in use: " + rollNumber));
                    continue;
                }

                Long departmentId = null;
                if (!deptCode.isBlank()) {
                    departmentId = deptIdByCode.get(deptCode);
                    if (departmentId == null) {
                        errors.add(new RowError(lineNum, email, "Unknown department code: " + deptCode));
                        continue;
                    }
                }

                Short graduationYear = null;
                if (!gradYearStr.isBlank()) {
                    try {
                        int yr = Integer.parseInt(gradYearStr);
                        if (yr < 2000 || yr > 2100) {
                            errors.add(new RowError(lineNum, email, "Graduation year must be 2000–2100."));
                            continue;
                        }
                        graduationYear = (short) yr;
                    } catch (NumberFormatException ex) {
                        errors.add(new RowError(lineNum, email, "Invalid graduation year: " + gradYearStr));
                        continue;
                    }
                }

                BigDecimal cgpa = null;
                if (!cgpaStr.isBlank()) {
                    try {
                        cgpa = new BigDecimal(cgpaStr);
                        if (cgpa.compareTo(BigDecimal.ZERO) < 0 || cgpa.compareTo(new BigDecimal("10.00")) > 0) {
                            errors.add(new RowError(lineNum, email, "CGPA must be between 0 and 10."));
                            continue;
                        }
                    } catch (NumberFormatException ex) {
                        errors.add(new RowError(lineNum, email, "Invalid CGPA: " + cgpaStr));
                        continue;
                    }
                }

                short backlogs = 0;
                if (!backlogsStr.isBlank()) {
                    try {
                        int b = Integer.parseInt(backlogsStr);
                        if (b < 0 || b > 32767) {
                            errors.add(new RowError(lineNum, email, "Active backlogs must be 0 or greater."));
                            continue;
                        }
                        backlogs = (short) b;
                    } catch (NumberFormatException ex) {
                        errors.add(new RowError(lineNum, email, "Invalid active backlogs: " + backlogsStr));
                        continue;
                    }
                }

                UserAccount savedUser = userRepository.save(
                        UserAccount.create(
                                email,
                                fullName,
                                encodedDefaultPassword,
                                Role.STUDENT,
                                departmentId,
                                Instant.now()
                        )
                );

                StudentProfile profile = new StudentProfile(savedUser.getId());
                profile.updateDetails(
                        rollNumber.isBlank() ? null : rollNumber,
                        null,
                        null,
                        null,
                        branch.isBlank() ? null : branch,
                        graduationYear,
                        cgpa,
                        backlogs,
                        null
                );
                studentProfileRepository.save(profile);
                createdCount++;
            }
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Could not read the uploaded CSV file.");
        }

        return new ImportResult(totalRows, createdCount, totalRows - createdCount, errors);
    }

    private boolean isHeaderRow(List<String> cols) {
        if (cols.isEmpty()) return false;
        String first = cols.get(0).replace("\uFEFF", "").trim().toLowerCase(Locale.ROOT);
        return first.equals("fullname") || first.equals("full_name") || first.equals("name");
    }

    private String col(List<String> cols, int index) {
        return index < cols.size() ? cols.get(index).trim() : "";
    }

    private List<String> parseCsvLine(String line) {
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
