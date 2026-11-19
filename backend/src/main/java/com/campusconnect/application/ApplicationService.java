package com.campusconnect.application;

import com.campusconnect.account.Dtos.PageResponse;
import com.campusconnect.application.ApplicationDtos.ApplicationResponse;
import com.campusconnect.application.ApplicationDtos.ApplicationRow;
import com.campusconnect.auth.AuthUser;
import com.campusconnect.auth.Role;
import com.campusconnect.auth.UserAccount;
import com.campusconnect.auth.UserRepository;
import com.campusconnect.common.ApiException;
import com.campusconnect.company.Company;
import com.campusconnect.company.CompanyRepository;
import com.campusconnect.department.DepartmentRepository;
import com.campusconnect.drive.DriveRepository;
import com.campusconnect.drive.DriveService;
import com.campusconnect.drive.DriveStatus;
import com.campusconnect.drive.EligibilityEvaluator;
import com.campusconnect.drive.EligibilityResult;
import com.campusconnect.drive.PlacementDrive;
import com.campusconnect.notification.NotificationService;
import com.campusconnect.student.StudentProfile;
import com.campusconnect.student.StudentProfileRepository;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ApplicationService {

    private final ApplicationRepository applications;
    private final ApplicationHistoryRepository history;
    private final DriveRepository drives;
    private final CompanyRepository companies;
    private final StudentProfileRepository profiles;
    private final UserRepository users;
    private final DepartmentRepository departments;
    private final Clock clock;

    @Autowired(required = false)
    private NotificationService notifications;

    public ApplicationService(
            ApplicationRepository applications,
            ApplicationHistoryRepository history,
            DriveRepository drives,
            CompanyRepository companies,
            StudentProfileRepository profiles,
            UserRepository users,
            DepartmentRepository departments,
            Clock clock) {

        this.applications = applications;
        this.history = history;
        this.drives = drives;
        this.companies = companies;
        this.profiles = profiles;
        this.users = users;
        this.departments = departments;
        this.clock = clock;
    }

    // ---------------- student actions ----------------

    /** Applies the student to an OPEN drive. */
    public ApplicationResponse apply(AuthUser student, Long driveId) {

        PlacementDrive drive = drives.findById(driveId)
                .filter(d -> d.getStatus() == DriveStatus.OPEN)
                .orElseThrow(() ->
                        new ApiException(HttpStatus.NOT_FOUND, "Drive not found."));

        Instant now = clock.instant();

        if (!drive.getApplicationDeadline().isAfter(now)) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "The application deadline for this drive has passed.");
        }

        if (applications.existsByDriveIdAndStudentUserId(
                driveId, student.id())) {
            throw duplicate();
        }

        StudentProfile profile =
                profiles.findByUserId(student.id()).orElse(null);

        EligibilityResult eligibility =
                EligibilityEvaluator.evaluate(profile, drive);

        if (!eligibility.eligible()) {
            throw new ApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "You are not eligible for this drive. "
                            + String.join(" ", eligibility.reasons()));
        }

        Application saved;

        try {
            saved = applications.saveAndFlush(
                    new Application(driveId, student.id(), now));
        } catch (DataIntegrityViolationException e) {
            throw duplicate();
        }

        history.save(new ApplicationStatusHistory(
                saved.getId(),
                null,
                ApplicationStatus.APPLIED,
                student.id(),
                now,
                null));

        return toResponse(
                saved,
                drive,
                companyName(drive.getCompanyId()));
    }

    @Transactional(readOnly = true)
    public PageResponse<ApplicationResponse> mine(
            AuthUser student, int page, int size) {
        return mine(student, null, null, page, size);
    }

    @Transactional(readOnly = true)
    public PageResponse<ApplicationResponse> mine(
            AuthUser student,
            String search,
            ApplicationStatus status,
            int page,
            int size) {

        Specification<Application> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("studentUserId"), student.id()));

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }

            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase() + "%";

                Subquery<Long> companySub = query.subquery(Long.class);
                Root<Company> companyRoot = companySub.from(Company.class);
                companySub.select(companyRoot.<Long>get("id"))
                        .where(cb.like(cb.lower(companyRoot.get("name")), pattern));

                Subquery<Long> driveSub = query.subquery(Long.class);
                Root<PlacementDrive> driveRoot = driveSub.from(PlacementDrive.class);
                driveSub.select(driveRoot.<Long>get("id"))
                        .where(cb.or(
                                cb.like(cb.lower(driveRoot.get("title")), pattern),
                                driveRoot.get("companyId").in(companySub)));

                predicates.add(root.get("driveId").in(driveSub));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<Application> result =
                applications.findAll(
                        spec,
                        DriveService.pageable(
                                page,
                                size,
                                Sort.by(Sort.Direction.DESC, "appliedAt")));

        Map<Long, PlacementDrive> driveById =
                drivesById(result.getContent());

        Map<Long, String> names =
                companyNamesFor(driveById.values());

        List<ApplicationResponse> items =
                result.getContent().stream().map(a -> {
                    PlacementDrive d = driveById.get(a.getDriveId());

                    return toResponse(
                            a,
                            d,
                            names.get(d.getCompanyId()));
                }).toList();

        return new PageResponse<>(
                items,
                result.getNumber(),
                result.getSize(),
                result.getTotalElements());
    }

    /** A student can withdraw only their own application. */
    public ApplicationResponse withdraw(
            AuthUser student, Long applicationId) {

        Application a =
                applications.findByIdAndStudentUserId(
                        applicationId,
                        student.id())
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Application not found."));

        if (!a.getStatus().canWithdraw()) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "An application that is "
                            + a.getStatus()
                            + " cannot be withdrawn.");
        }

        transition(
                a,
                ApplicationStatus.WITHDRAWN,
                student.id(),
                "Withdrawn by student");

        PlacementDrive d =
                drives.findById(a.getDriveId()).orElseThrow();

        return toResponse(
                a,
                d,
                companyName(d.getCompanyId()));
    }

    // ---------------- administrator / SPOC views ----------------

    @Transactional(readOnly = true)
    public PageResponse<ApplicationRow> list(
            AuthUser actor,
            Long driveId,
            ApplicationStatus status,
            int page,
            int size) {
        return list(actor, driveId, status, null, null, null, page, size);
    }

    /**
     * Admins see all applications.
     * A SPOC sees only applications belonging to students whose profile
     * branch matches the SPOC's department name.
     */
    @Transactional(readOnly = true)
    public PageResponse<ApplicationRow> list(
            AuthUser actor,
            Long driveId,
            ApplicationStatus status,
            String search,
            String branch,
            Integer batch,
            int page,
            int size) {

        String departmentName = null;

        if (actor.role() == Role.DEPARTMENT_SPOC) {

            if (actor.departmentId() == null) {
                throw new AccessDeniedException(
                        "SPOC has no department");
            }

            departmentName = departments
                    .findById(actor.departmentId())
                    .map(department -> department.getName())
                    .orElseThrow(() ->
                            new AccessDeniedException(
                                    "SPOC department not found"));

        } else if (actor.role() != Role.PLACEMENT_ADMIN) {

            throw new AccessDeniedException("Not allowed");
        }

        Page<Application> result =
                applications.findAll(
                        filter(driveId, status, departmentName, search, branch, batch),
                        DriveService.pageable(
                                page,
                                size,
                                Sort.by(
                                        Sort.Direction.DESC,
                                        "appliedAt")));

        Map<Long, PlacementDrive> driveById =
                drivesById(result.getContent());

        Map<Long, String> names =
                companyNamesFor(driveById.values());

        List<Long> studentIds =
                result.getContent().stream()
                        .map(Application::getStudentUserId)
                        .distinct()
                        .toList();

        Map<Long, UserAccount> userById =
                users.findAllById(studentIds).stream()
                        .collect(Collectors.toMap(
                                UserAccount::getId,
                                Function.identity()));

        Map<Long, StudentProfile> profileByUser =
                profiles.findByUserIdIn(studentIds).stream()
                        .collect(Collectors.toMap(
                                StudentProfile::getUserId,
                                Function.identity()));

        List<ApplicationRow> rows =
                result.getContent().stream().map(a -> {

                    PlacementDrive d =
                            driveById.get(a.getDriveId());

                    UserAccount u =
                            userById.get(a.getStudentUserId());

                    StudentProfile p =
                            profileByUser.get(a.getStudentUserId());

                    return new ApplicationRow(
                            a.getId(),
                            d.getId(),
                            names.get(d.getCompanyId()),
                            d.getTitle(),
                            a.getStudentUserId(),
                            u == null ? null : u.getFullName(),
                            u == null ? null : u.getEmail(),
                            p == null ? null : p.getBranch(),
                            p == null || p.getGraduationYear() == null
                                    ? null
                                    : p.getGraduationYear().intValue(),
                            p == null ? null : p.getCgpa(),
                            a.getStatus(),
                            a.getAppliedAt());

                }).toList();

        return new PageResponse<>(
                rows,
                result.getNumber(),
                result.getSize(),
                result.getTotalElements());
    }

    /** Administrator decision. */
    public void changeStatus(
            AuthUser admin,
            Long applicationId,
            ApplicationStatus target,
            String note) {

        Application a =
                applications.findById(applicationId)
                        .orElseThrow(() ->
                                new ApiException(
                                        HttpStatus.NOT_FOUND,
                                        "Application not found."));

        if (!a.getStatus().adminTargets().contains(target)) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "An application cannot move from "
                            + a.getStatus()
                            + " to "
                            + target
                            + ".");
        }

        String cleanNote = (note == null || note.isBlank()) ? null : note.trim();
        transition(a, target, admin.id(), cleanNote);

        if (notifications != null) {
            PlacementDrive drive = drives.findById(a.getDriveId()).orElse(null);
            String company = drive == null ? null : companyName(drive.getCompanyId());
            String email = users.findById(a.getStudentUserId())
                    .map(UserAccount::getEmail)
                    .orElse(null);
            String driveLabel = (company != null ? company + " - " : "")
                    + (drive != null ? drive.getTitle() : "Placement Drive");
            String msg = "Your application for " + driveLabel + " is now " + target.name() + "."
                    + (cleanNote != null ? " Note: " + cleanNote : "");

            notifications.notifyUser(
                    a.getStudentUserId(),
                    email,
                    "Application " + target.name() + ": " + driveLabel,
                    msg,
                    "APPLICATION_STATUS",
                    "/student/applications");
        }
    }

    // ---------------- helpers ----------------

    private void transition(
            Application a,
            ApplicationStatus to,
            Long actorId,
            String note) {

        ApplicationStatus from = a.getStatus();

        a.setStatus(to);
        applications.save(a);

        history.save(new ApplicationStatusHistory(
                a.getId(),
                from,
                to,
                actorId,
                clock.instant(),
                note));
    }

    private static Specification<Application> filter(
            Long driveId,
            ApplicationStatus status,
            String departmentName,
            String search,
            String branch,
            Integer batch) {

        return (root, query, cb) -> {

            List<Predicate> predicates = new ArrayList<>();

            if (driveId != null) {
                predicates.add(
                        cb.equal(root.get("driveId"), driveId));
            }

            if (status != null) {
                predicates.add(
                        cb.equal(root.get("status"), status));
            }

            String effectiveBranch = departmentName != null
                    ? departmentName
                    : (branch != null && !branch.isBlank() ? branch.trim() : null);

            if (effectiveBranch != null || batch != null) {
                Subquery<Long> profileQuery = query.subquery(Long.class);
                Root<StudentProfile> profile = profileQuery.from(StudentProfile.class);
                List<Predicate> profilePreds = new ArrayList<>();

                if (effectiveBranch != null) {
                    profilePreds.add(cb.equal(
                            cb.lower(profile.get("branch")),
                            effectiveBranch.toLowerCase()));
                }
                if (batch != null) {
                    profilePreds.add(cb.equal(
                            profile.get("graduationYear"),
                            batch.shortValue()));
                }

                profileQuery
                        .select(profile.<Long>get("userId"))
                        .where(profilePreds.toArray(new Predicate[0]));

                predicates.add(root.get("studentUserId").in(profileQuery));
            }

            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase() + "%";

                Subquery<Long> userSub = query.subquery(Long.class);
                Root<UserAccount> userRoot = userSub.from(UserAccount.class);
                userSub.select(userRoot.<Long>get("id"))
                        .where(cb.or(
                                cb.like(cb.lower(userRoot.get("fullName")), pattern),
                                cb.like(cb.lower(userRoot.get("email")), pattern)));

                Subquery<Long> companySub = query.subquery(Long.class);
                Root<Company> companyRoot = companySub.from(Company.class);
                companySub.select(companyRoot.<Long>get("id"))
                        .where(cb.like(cb.lower(companyRoot.get("name")), pattern));

                Subquery<Long> driveSub = query.subquery(Long.class);
                Root<PlacementDrive> driveRoot = driveSub.from(PlacementDrive.class);
                driveSub.select(driveRoot.<Long>get("id"))
                        .where(cb.or(
                                cb.like(cb.lower(driveRoot.get("title")), pattern),
                                driveRoot.get("companyId").in(companySub)));

                predicates.add(cb.or(
                        root.get("studentUserId").in(userSub),
                        root.get("driveId").in(driveSub)));
            }

            return cb.and(
                    predicates.toArray(new Predicate[0]));
        };
    }

    private Map<Long, PlacementDrive> drivesById(
            List<Application> list) {

        Map<Long, PlacementDrive> map = new HashMap<>();

        if (!list.isEmpty()) {
            drives.findAllById(
                    list.stream()
                            .map(Application::getDriveId)
                            .collect(Collectors.toCollection(
                                    LinkedHashSet::new)))
                    .forEach(d -> map.put(d.getId(), d));
        }

        return map;
    }

    private Map<Long, String> companyNamesFor(
            java.util.Collection<PlacementDrive> drivesList) {

        Map<Long, String> names = new HashMap<>();

        if (!drivesList.isEmpty()) {
            companies.findAllById(
                    drivesList.stream()
                            .map(PlacementDrive::getCompanyId)
                            .collect(Collectors.toCollection(
                                    LinkedHashSet::new)))
                    .forEach(c -> names.put(
                            c.getId(),
                            c.getName()));
        }

        return names;
    }

    private String companyName(Long companyId) {
        return companies.findById(companyId)
                .map(c -> c.getName())
                .orElse(null);
    }

    private static ApplicationResponse toResponse(
            Application a,
            PlacementDrive d,
            String companyName) {

        return new ApplicationResponse(
                a.getId(),
                d.getId(),
                companyName,
                d.getTitle(),
                a.getStatus(),
                a.getAppliedAt(),
                a.getUpdatedAt(),
                d.getApplicationDeadline());
    }

    private static ApiException duplicate() {
        return new ApiException(
                HttpStatus.CONFLICT,
                "You have already applied to this drive.");
    }
}