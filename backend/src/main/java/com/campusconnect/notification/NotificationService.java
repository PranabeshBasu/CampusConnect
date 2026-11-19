package com.campusconnect.notification;

import com.campusconnect.application.ApplicationRepository;
import com.campusconnect.auth.Role;
import com.campusconnect.auth.UserAccount;
import com.campusconnect.auth.UserRepository;
import com.campusconnect.common.ApiException;
import com.campusconnect.drive.DriveRepository;
import com.campusconnect.drive.DriveStatus;
import com.campusconnect.drive.EligibilityEvaluator;
import com.campusconnect.drive.PlacementDrive;
import com.campusconnect.student.StudentProfile;
import com.campusconnect.student.StudentProfileRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notificationRepository;
    private final DeadlineReminderSentRepository reminderRepository;
    private final UserRepository userRepository;
    private final StudentProfileRepository profileRepository;
    private final DriveRepository driveRepository;
    private final ApplicationRepository applicationRepository;
    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final String mailUsername;

    public NotificationService(
            NotificationRepository notificationRepository,
            DeadlineReminderSentRepository reminderRepository,
            UserRepository userRepository,
            StudentProfileRepository profileRepository,
            DriveRepository driveRepository,
            ApplicationRepository applicationRepository,
            ObjectProvider<JavaMailSender> mailSenderProvider,
            @Value("${spring.mail.username:}") String mailUsername) {
        this.notificationRepository = notificationRepository;
        this.reminderRepository = reminderRepository;
        this.userRepository = userRepository;
        this.profileRepository = profileRepository;
        this.driveRepository = driveRepository;
        this.applicationRepository = applicationRepository;
        this.mailSenderProvider = mailSenderProvider;
        this.mailUsername = mailUsername;
    }

    public record NotificationListResponse(long unreadCount, List<Notification> items) {}

    @Transactional
    public void notifyUser(Long userId, String email, String title, String message, String type, String link) {
        notificationRepository.save(new Notification(userId, title, message, type, link));
        sendEmailAsync(email, title, message);
    }

    @Async
    public void sendEmailAsync(String to, String subject, String body) {
        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (sender == null || mailUsername == null || mailUsername.isBlank() || to == null || to.isBlank()) {
            return;
        }
        try {
            SimpleMailMessage mail = new SimpleMailMessage();
            mail.setFrom(mailUsername);
            mail.setTo(to);
            mail.setSubject("CampusConnect: " + subject);
            mail.setText(body + "\n\nSign in to CampusConnect to view details.");
            sender.send(mail);
        } catch (Exception ex) {
            log.warn("Failed to send email to {}: {}", to, ex.getMessage());
        }
    }

    @Transactional
    public void notifyEligibleStudentsForDrive(PlacementDrive drive) {
        List<UserAccount> students = userRepository.findAll().stream()
                .filter(u -> u.getRole() == Role.STUDENT && u.isEnabled())
                .toList();
        Map<Long, StudentProfile> profiles = profileRepository.findAll().stream()
                .collect(Collectors.toMap(StudentProfile::getUserId, Function.identity()));

        for (UserAccount student : students) {
            StudentProfile p = profiles.get(student.getId());
            if (p != null && EligibilityEvaluator.evaluate(p, drive).eligible()) {
                notifyUser(
                        student.getId(),
                        student.getEmail(),
                        "New Eligible Drive: " + drive.getTitle(),
                        "A new placement drive (" + drive.getTitle() + ") is now open and matches your profile.",
                        "DRIVE_OPEN",
                        "/student/drives"
                );
            }
        }
    }

    @Scheduled(fixedDelay = 900_000)
    @Transactional
    public void sendDeadlineReminders() {
        Instant now = Instant.now();
        Instant in24Hours = now.plus(24, ChronoUnit.HOURS);

        List<PlacementDrive> dueSoon = driveRepository.findAll().stream()
                .filter(d -> d.getStatus() == DriveStatus.OPEN
                        && d.getApplicationDeadline().isAfter(now)
                        && d.getApplicationDeadline().isBefore(in24Hours))
                .toList();

        if (dueSoon.isEmpty()) return;

        List<UserAccount> students = userRepository.findAll().stream()
                .filter(u -> u.getRole() == Role.STUDENT && u.isEnabled())
                .toList();
        Map<Long, StudentProfile> profiles = profileRepository.findAll().stream()
                .collect(Collectors.toMap(StudentProfile::getUserId, Function.identity()));

        for (PlacementDrive drive : dueSoon) {
            for (UserAccount student : students) {
                if (reminderRepository.existsByDriveIdAndUserId(drive.getId(), student.getId())) continue;
                if (applicationRepository.existsByDriveIdAndStudentUserId(drive.getId(), student.getId())) continue;

                StudentProfile p = profiles.get(student.getId());
                if (p != null && EligibilityEvaluator.evaluate(p, drive).eligible()) {
                    reminderRepository.save(new DeadlineReminderSent(drive.getId(), student.getId()));
                    notifyUser(
                            student.getId(),
                            student.getEmail(),
                            "24h Deadline Reminder: " + drive.getTitle(),
                            "Applications for " + drive.getTitle() + " close within 24 hours.",
                            "DEADLINE_REMINDER",
                            "/student/drives"
                    );
                }
            }
        }
    }

    @Transactional(readOnly = true)
    public NotificationListResponse listForUser(Long userId) {
        return new NotificationListResponse(
                notificationRepository.countByUserIdAndReadFalse(userId),
                notificationRepository.findTop20ByUserIdOrderByCreatedAtDesc(userId)
        );
    }

    @Transactional
    public void markRead(Long notificationId, Long userId) {
        Notification n = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Notification not found."));
        if (!userId.equals(n.getUserId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Access denied.");
        }
        n.markRead();
        notificationRepository.save(n);
    }

    @Transactional
    public void markAllRead(Long userId) {
        List<Notification> items = notificationRepository.findTop20ByUserIdOrderByCreatedAtDesc(userId);
        items.forEach(Notification::markRead);
        notificationRepository.saveAll(items);
    }
}