package com.campusconnect.application;

import com.campusconnect.account.Dtos.PageResponse;
import com.campusconnect.auth.AuthUser;
import com.campusconnect.common.ApiException;
import com.campusconnect.company.Company;
import com.campusconnect.drive.DriveDtos.DriveResponse;
import com.campusconnect.drive.DriveDtos.StudentDriveView;
import com.campusconnect.drive.DriveRepository;
import com.campusconnect.drive.DriveService;
import com.campusconnect.drive.DriveStatus;
import com.campusconnect.drive.EligibilityEvaluator;
import com.campusconnect.drive.PlacementDrive;
import com.campusconnect.student.StudentProfile;
import com.campusconnect.student.StudentProfileRepository;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Student-facing drive browsing: only OPEN drives that still accept applications, with a per-student eligibility verdict. */
@Service
@Transactional(readOnly = true)
public class StudentDriveService {

    private final DriveRepository drives;
    private final DriveService driveService;
    private final StudentProfileRepository profiles;
    private final ApplicationRepository applications;
    private final Clock clock;

    public StudentDriveService(DriveRepository drives, DriveService driveService, StudentProfileRepository profiles,
                               ApplicationRepository applications, Clock clock) {
        this.drives = drives;
        this.driveService = driveService;
        this.profiles = profiles;
        this.applications = applications;
        this.clock = clock;
    }

    public PageResponse<StudentDriveView> list(AuthUser student, int page, int size) {
        return list(student, null, null, null, page, size);
    }

    public PageResponse<StudentDriveView> list(AuthUser student, String search, String branch, Integer batch, int page, int size) {
        Instant now = clock.instant();
        Specification<PlacementDrive> open = (root, query, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            ps.add(cb.equal(root.get("status"), DriveStatus.OPEN));
            ps.add(cb.greaterThan(root.get("applicationDeadline"), now));

            if (batch != null) {
                ps.add(cb.equal(root.get("graduationYear"), batch.shortValue()));
            }

            if (branch != null && !branch.isBlank()) {
                query.distinct(true);
                Join<PlacementDrive, String> branchJoin = root.join("branches");
                ps.add(cb.equal(cb.lower(branchJoin), branch.trim().toLowerCase()));
            }

            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase() + "%";
                Subquery<Long> companySub = query.subquery(Long.class);
                Root<Company> companyRoot = companySub.from(Company.class);
                companySub.select(companyRoot.<Long>get("id"))
                        .where(cb.like(cb.lower(companyRoot.get("name")), pattern));

                ps.add(cb.or(
                        cb.like(cb.lower(root.get("title")), pattern),
                        cb.like(cb.lower(root.get("location")), pattern),
                        root.get("companyId").in(companySub)));
            }

            return cb.and(ps.toArray(new Predicate[0]));
        };

        Page<PlacementDrive> result = drives.findAll(open,
                DriveService.pageable(page, size, Sort.by(Sort.Direction.ASC, "applicationDeadline")));

        StudentProfile profile = profiles.findByUserId(student.id()).orElse(null);
        List<Long> ids = result.getContent().stream().map(PlacementDrive::getId).toList();
        Map<Long, Application> mine = ids.isEmpty() ? Map.of()
                : applications.findByStudentUserIdAndDriveIdIn(student.id(), ids).stream()
                        .collect(Collectors.toMap(Application::getDriveId, Function.identity()));
        Map<Long, Company> companyMap = driveService.companiesById(
                result.getContent().stream().map(PlacementDrive::getCompanyId).toList());

        List<StudentDriveView> items = result.getContent().stream()
                .map(d -> {
                    Company c = companyMap.get(d.getCompanyId());
                    return view(
                            d,
                            c == null ? null : c.getName(),
                            c == null ? null : c.getWebsite(),
                            c == null ? null : c.getLogoUrl(),
                            profile,
                            mine.get(d.getId()));
                })
                .toList();
        return new PageResponse<>(items, result.getNumber(), result.getSize(), result.getTotalElements());
    }

    public StudentDriveView get(AuthUser student, Long driveId) {
        PlacementDrive d = drives.findById(driveId).filter(x -> x.getStatus() == DriveStatus.OPEN)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Drive not found."));
        StudentProfile profile = profiles.findByUserId(student.id()).orElse(null);
        Application mine = applications.findByStudentUserIdAndDriveIdIn(student.id(), List.of(driveId)).stream().findFirst().orElse(null);
        Company c = driveService.companiesById(List.of(d.getCompanyId())).get(d.getCompanyId());
        return view(
                d,
                c == null ? null : c.getName(),
                c == null ? null : c.getWebsite(),
                c == null ? null : c.getLogoUrl(),
                profile,
                mine);
    }

    private static StudentDriveView view(
            PlacementDrive d,
            String companyName,
            String companyWebsite,
            String companyLogoUrl,
            StudentProfile profile,
            Application mine) {
        return new StudentDriveView(
                DriveResponse.from(d, companyName, companyWebsite, companyLogoUrl),
                EligibilityEvaluator.evaluate(profile, d),
                mine == null ? null : mine.getId(),
                mine == null ? null : mine.getStatus().name());
    }
}