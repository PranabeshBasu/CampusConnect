package com.campusconnect.student;

import com.campusconnect.account.Dtos.PageResponse;
import com.campusconnect.auth.Role;
import com.campusconnect.auth.UserAccount;
import com.campusconnect.auth.UserRepository;
import com.campusconnect.student.SpocStudentController.SpocStudentRow;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class SpocStudentService {

    private final UserRepository userRepository;
    private final StudentProfileRepository studentProfileRepository;

    public SpocStudentService(
            UserRepository userRepository,
            StudentProfileRepository studentProfileRepository) {
        this.userRepository = userRepository;
        this.studentProfileRepository = studentProfileRepository;
    }

    @Transactional(readOnly = true)
    public PageResponse<SpocStudentRow> listDepartmentStudents(
            Long departmentId,
            String search,
            Boolean verified,
            Pageable pageable) {
        List<UserAccount> deptStudents = userRepository
                .findByDepartmentId(departmentId, PageRequest.of(0, 1000))
                .getContent()
                .stream()
                .filter(u -> u.getRole() == Role.STUDENT)
                .toList();

        List<Long> userIds = deptStudents.stream().map(UserAccount::getId).toList();
        Map<Long, StudentProfile> profilesByUser = userIds.isEmpty()
                ? Map.of()
                : studentProfileRepository.findByUserIdIn(userIds).stream()
                        .collect(Collectors.toMap(StudentProfile::getUserId, Function.identity()));

        String q = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);

        List<SpocStudentRow> filtered = deptStudents.stream()
                .map(u -> toSpocStudentRow(u, profilesByUser.get(u.getId())))
                .filter(row -> {
                    if (verified != null) {
                        if (verified && !row.verified()) return false;
                        if (!verified && (!row.hasProfile() || row.verified())) return false;
                    }
                    if (!q.isEmpty()) {
                        String hay = String.join(" ",
                                row.fullName(),
                                row.email(),
                                row.enrollmentNo() == null ? "" : row.enrollmentNo(),
                                row.rollNumber() == null ? "" : row.rollNumber(),
                                row.branch() == null ? "" : row.branch()
                        ).toLowerCase(Locale.ROOT);
                        return hay.contains(q);
                    }
                    return true;
                })
                .toList();

        int start = (int) Math.min(pageable.getOffset(), filtered.size());
        int end = Math.min(start + pageable.getPageSize(), filtered.size());
        return new PageResponse<>(filtered.subList(start, end), pageable.getPageNumber(), pageable.getPageSize(), filtered.size());
    }

    @Transactional
    public SpocStudentRow verifyStudentProfile(
            Long departmentId,
            Long studentUserId,
            Long spocUserId,
            boolean verified,
            String note) {
        UserAccount student = userRepository.findById(studentUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found."));

        if (student.getRole() != Role.STUDENT || !departmentId.equals(student.getDepartmentId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Student does not belong to this department.");
        }

        StudentProfile profile = studentProfileRepository.findByUserId(studentUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Student has not created a profile yet."));

        profile.setVerification(verified, spocUserId, note);
        StudentProfile saved = studentProfileRepository.save(profile);
        return toSpocStudentRow(student, saved);
    }

    private SpocStudentRow toSpocStudentRow(UserAccount u, StudentProfile p) {
        return new SpocStudentRow(
                u.getId(),
                u.getFullName(),
                u.getEmail(),
                p != null ? p.getEnrollmentNo() : null,
                p != null ? p.getRollNumber() : null,
                p != null ? p.getBranch() : null,
                p != null ? p.getGraduationYear() : null,
                p != null ? p.getCgpa() : null,
                p != null && p.getActiveBacklogs() != null ? p.getActiveBacklogs() : (short) 0,
                p != null,
                p != null && p.hasResume(),
                p != null && p.isVerified(),
                p != null ? p.getVerifiedAt() : null,
                p != null ? p.getVerificationNote() : null
        );
    }
}