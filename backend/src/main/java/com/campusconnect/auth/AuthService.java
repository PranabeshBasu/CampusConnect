package com.campusconnect.auth;

import com.campusconnect.account.Dtos.RegisterRequest;
import com.campusconnect.common.ApiException;
import com.campusconnect.common.PasswordPolicy;
import com.campusconnect.student.StudentRegistry;
import com.campusconnect.student.StudentRegistryRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Registration and credential checks. Deliberately NOT @Transactional on authenticate: failed-login counters must be
 * saved even though the method then throws.
 */
@Service
public class AuthService {

    public record EnrollmentLookupResponse(
            String enrollmentNo,
            String registrationNo,
            String fullName,
            String department,
            String stream,
            Short graduationYear) {}

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final Clock clock;
    private final int maxFailedLogins;
    private final Duration lockout;
    private final String dummyHash;

    @Autowired(required = false)
    private StudentRegistryRepository registry;

    public AuthService(UserRepository users, PasswordEncoder encoder, Clock clock,
                       @Value("${app.security.max-failed-logins:5}") int maxFailedLogins,
                       @Value("${app.security.lockout-minutes:15}") long lockoutMinutes) {
        this.users = users;
        this.encoder = encoder;
        this.clock = clock;
        this.maxFailedLogins = maxFailedLogins;
        this.lockout = Duration.ofMinutes(lockoutMinutes);
        this.dummyHash = encoder.encode("unused-password-for-timing-0");
    }

    public static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    public static boolean isAllowedCollegeEmail(String email) {
        return email != null && (email.endsWith("@iem.edu.in") || email.endsWith("@uem.edu.in"));
    }

    public EnrollmentLookupResponse lookupEnrollment(String rawEnrollmentNo) {
        if (registry == null) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Student registry is unavailable.");
        }
        String enrollmentNo = rawEnrollmentNo == null ? "" : rawEnrollmentNo.trim();
        if (enrollmentNo.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Enter your enrollment number.");
        }
        StudentRegistry entry = registry.findByEnrollmentNoIgnoreCase(enrollmentNo)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND,
                        "Enrollment number not found in placement registry. Contact your Placement Admin."));
        if (entry.getClaimedUserId() != null) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "An account for this enrollment number is already registered.");
        }
        return new EnrollmentLookupResponse(
                entry.getEnrollmentNo(),
                entry.getRegistrationNo(),
                entry.getFullName(),
                entry.getDepartment(),
                entry.getStream(),
                entry.getGraduationYear());
    }

    /** Public registration can only ever create a STUDENT. */
    public UserAccount registerStudent(RegisterRequest r) {
        return registerStudent(null, r.email(), r.fullName(), r.password());
    }

    @Transactional
    public UserAccount registerStudent(String rawEnrollmentNo, String rawEmail, String rawFullName, String password) {
        PasswordPolicy.validate(password);
        String email = normalizeEmail(rawEmail);

        if (registry != null) {
            String enrollmentNo = rawEnrollmentNo == null ? "" : rawEnrollmentNo.trim();
            if (enrollmentNo.isEmpty()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Enrollment number is required.");
            }
            if (!isAllowedCollegeEmail(email)) {
                throw new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "Registration requires an @iem.edu.in or @uem.edu.in email address.");
            }
            StudentRegistry entry = registry.findByEnrollmentNoIgnoreCase(enrollmentNo)
                    .orElseThrow(() -> new ApiException(
                            HttpStatus.NOT_FOUND,
                            "Enrollment number not found in placement registry."));
            if (entry.getClaimedUserId() != null) {
                throw new ApiException(
                        HttpStatus.CONFLICT,
                        "An account for this enrollment number is already registered.");
            }
            if (users.existsByEmail(email)) {
                throw emailTaken();
            }

            UserAccount account = UserAccount.create(
                    email, entry.getFullName(), encoder.encode(password), Role.STUDENT, null, clock.instant());
            try {
                UserAccount saved = users.saveAndFlush(account);
                entry.setClaimedUserId(saved.getId());
                registry.save(entry);
                return saved;
            } catch (DataIntegrityViolationException e) {
                throw emailTaken();
            }
        }

        if (users.existsByEmail(email)) {
            throw emailTaken();
        }
        UserAccount account = UserAccount.create(
                email, rawFullName.trim(), encoder.encode(password), Role.STUDENT, null, clock.instant());
        try {
            return users.saveAndFlush(account);
        } catch (DataIntegrityViolationException e) {
            throw emailTaken();
        }
    }

    /** Returns the account on success; otherwise throws the same generic 401 for every failure reason. */
    public UserAccount authenticate(String rawEmail, String password) {
        Optional<UserAccount> found = users.findByEmail(normalizeEmail(rawEmail));
        if (found.isEmpty()) {
            encoder.matches(password, dummyHash);
            throw badCredentials();
        }
        UserAccount user = found.get();
        Instant now = clock.instant();
        if (user.isLockedAt(now)) {
            throw badCredentials();
        }
        if (!encoder.matches(password, user.getPasswordHash())) {
            user.registerFailure(now, maxFailedLogins, lockout);
            users.save(user);
            throw badCredentials();
        }
        if (!user.isEnabled()) {
            throw badCredentials();
        }
        if (user.getFailedLoginAttempts() != 0 || user.getLockedUntil() != null) {
            user.clearFailures();
            users.save(user);
        }
        return user;
    }

    private static ApiException badCredentials() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password.");
    }

    private static ApiException emailTaken() {
        return new ApiException(HttpStatus.CONFLICT, "An account with this email already exists.");
    }
}