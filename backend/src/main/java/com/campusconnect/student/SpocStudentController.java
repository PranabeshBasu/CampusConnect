package com.campusconnect.student;

import com.campusconnect.account.Dtos.PageResponse;
import com.campusconnect.auth.AuthUser;
import com.campusconnect.auth.Role;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;

@RestController
@RequestMapping("/api/v1/departments/{departmentId}/students")
@PreAuthorize("hasAnyRole('DEPARTMENT_SPOC', 'PLACEMENT_ADMIN')")
public class SpocStudentController {

    private final SpocStudentService spocStudentService;

    public SpocStudentController(SpocStudentService spocStudentService) {
        this.spocStudentService = spocStudentService;
    }

    public record SpocStudentRow(
        Long studentUserId,
        String fullName,
        String email,
        String enrollmentNo,
        String rollNumber,
        String branch,
        Short graduationYear,
        BigDecimal cgpa,
        short activeBacklogs,
        boolean hasProfile,
        boolean hasResume,
        boolean verified,
        Instant verifiedAt,
        String verificationNote
    ) {}

    public record VerifyStudentRequest(boolean verified, String note) {}

    @GetMapping
    public PageResponse<SpocStudentRow> listDepartmentStudents(
        @PathVariable Long departmentId,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) Boolean verified,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "25") int size,
        @AuthenticationPrincipal AuthUser principal
    ) {
        enforceDepartmentScope(departmentId, principal);
        return spocStudentService.listDepartmentStudents(
            departmentId, search, verified, PageRequest.of(page, Math.min(size, 100))
        );
    }

    @PatchMapping("/{studentUserId}/verify")
    public SpocStudentRow verifyStudent(
        @PathVariable Long departmentId,
        @PathVariable Long studentUserId,
        @RequestBody VerifyStudentRequest request,
        @AuthenticationPrincipal AuthUser principal
    ) {
        enforceDepartmentScope(departmentId, principal);
        return spocStudentService.verifyStudentProfile(
            departmentId, studentUserId, principal.id(), request.verified(), request.note()
        );
    }

    private void enforceDepartmentScope(Long departmentId, AuthUser principal) {
        if (principal.role() == Role.DEPARTMENT_SPOC
            && !departmentId.equals(principal.departmentId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access limited to your own department.");
        }
    }
}