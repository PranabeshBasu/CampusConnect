package com.campusconnect.calendar;

import com.campusconnect.company.Company;
import com.campusconnect.company.CompanyRepository;
import com.campusconnect.drive.DriveRepository;
import com.campusconnect.drive.DriveStatus;
import com.campusconnect.drive.PlacementDrive;
import com.campusconnect.round.RecruitmentRound;
import com.campusconnect.round.RecruitmentRoundRepository;
import com.campusconnect.round.RecruitmentRoundStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/calendar")
public class PlacementCalendarController {

    private final DriveRepository driveRepository;
    private final CompanyRepository companyRepository;
    private final RecruitmentRoundRepository roundRepository;

    public PlacementCalendarController(
            DriveRepository driveRepository,
            CompanyRepository companyRepository,
            RecruitmentRoundRepository roundRepository) {
        this.driveRepository = driveRepository;
        this.companyRepository = companyRepository;
        this.roundRepository = roundRepository;
    }

    public record CalendarEvent(
            String id,
            String type,
            String title,
            String companyName,
            String driveTitle,
            Instant startsAt,
            String location,
            String status
    ) {}

    @GetMapping
    public List<CalendarEvent> getCalendar() {
        List<PlacementDrive> drives = driveRepository.findAll();
        Map<Long, PlacementDrive> driveMap = drives.stream()
                .collect(Collectors.toMap(PlacementDrive::getId, Function.identity()));
        Map<Long, String> companyNames = companyRepository.findAll().stream()
                .collect(Collectors.toMap(Company::getId, Company::getName));

        List<CalendarEvent> events = new ArrayList<>();

        for (PlacementDrive d : drives) {
            if (d.getStatus() == DriveStatus.OPEN && d.getApplicationDeadline() != null) {
                events.add(new CalendarEvent(
                        "deadline-" + d.getId(),
                        "DEADLINE",
                        "Application Deadline",
                        companyNames.getOrDefault(d.getCompanyId(), "Company"),
                        d.getTitle(),
                        d.getApplicationDeadline(),
                        d.getLocation(),
                        d.getStatus().name()
                ));
            }
        }

        for (RecruitmentRound r : roundRepository.findAll()) {
            if (r.getStatus() == RecruitmentRoundStatus.SCHEDULED && r.getScheduledAt() != null) {
                PlacementDrive d = driveMap.get(r.getDriveId());
                String companyName = d != null ? companyNames.getOrDefault(d.getCompanyId(), "Company") : "Company";
                String driveTitle = d != null ? d.getTitle() : "Placement Drive";
                events.add(new CalendarEvent(
                        "round-" + r.getId(),
                        "ROUND",
                        "Round " + r.getSequenceNumber() + ": " + r.getName(),
                        companyName,
                        driveTitle,
                        r.getScheduledAt(),
                        r.getVenue(),
                        r.getStatus().name()
                ));
            }
        }

        events.sort(Comparator.comparing(CalendarEvent::startsAt));
        return events;
    }
}
