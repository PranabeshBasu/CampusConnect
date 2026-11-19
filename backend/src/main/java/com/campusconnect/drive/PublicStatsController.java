package com.campusconnect.drive;

import com.campusconnect.application.ApplicationRepository;
import com.campusconnect.application.ApplicationStatus;
import com.campusconnect.company.CompanyRepository;
import com.campusconnect.student.StudentProfileRepository;
import java.time.Clock;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public/stats")
public class PublicStatsController {

    /**
     * Aggregate, non-personal counts for the public landing page.
     * eligibleStudents = students whose profile has both a graduation year and a CGPA saved.
     * placedStudents is kept so older clients keep working.
     */
    public record PublicStatsResponse(
            long activeDrives,
            long registeredCompanies,
            long placedStudents,
            long eligibleStudents) {}

    private final DriveRepository drives;
    private final CompanyRepository companies;
    private final ApplicationRepository applications;
    private final StudentProfileRepository studentProfiles;
    private final Clock clock;

    public PublicStatsController(
            DriveRepository drives,
            CompanyRepository companies,
            ApplicationRepository applications,
            StudentProfileRepository studentProfiles,
            Clock clock) {
        this.drives = drives;
        this.companies = companies;
        this.applications = applications;
        this.studentProfiles = studentProfiles;
        this.clock = clock;
    }

    @GetMapping
    public PublicStatsResponse stats() {
        long activeDrives = drives.countByStatusAndApplicationDeadlineAfter(
                DriveStatus.OPEN,
                clock.instant());
        long registeredCompanies = companies.countByActiveTrue();
        long placedStudents = applications.countByStatus(ApplicationStatus.SELECTED);
        long eligibleStudents = studentProfiles.countByGraduationYearIsNotNullAndCgpaIsNotNull();

        return new PublicStatsResponse(activeDrives, registeredCompanies, placedStudents, eligibleStudents);
    }
}