package com.campusconnect.auth;

import com.campusconnect.student.StudentProfileRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

@Component
public class OAuth2SuccessHandler implements AuthenticationSuccessHandler {

    private final UserRepository userRepository;
    private final SessionLoginHelper sessionLoginHelper;
    private final String redirectBaseUrl;

    @Autowired(required = false)
    private StudentProfileRepository studentProfileRepository;

    public OAuth2SuccessHandler(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            SessionLoginHelper sessionLoginHelper,
            @Value("${app.oauth2.redirect-base-url:http://localhost:5173}") String redirectBaseUrl) {
        this.userRepository = userRepository;
        this.sessionLoginHelper = sessionLoginHelper;
        this.redirectBaseUrl = redirectBaseUrl.replaceAll("/$", "");
    }

    @Override
    public void onAuthenticationSuccess(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication) throws IOException {

        OAuth2User oauthUser = (OAuth2User) authentication.getPrincipal();
        String rawEmail = firstNonBlank(
                oauthUser.getAttribute("email"),
                oauthUser.getAttribute("preferred_username"),
                oauthUser.getAttribute("upn")
        );

        if (rawEmail == null) {
            response.sendRedirect(redirectBaseUrl + "/signin?oauthError=missing_email");
            return;
        }

        String email = rawEmail.trim().toLowerCase(Locale.ROOT);

        UserAccount account = userRepository.findByEmail(email).orElse(null);

        if (account == null && studentProfileRepository != null) {
            account = studentProfileRepository.findByPersonalEmailIgnoreCase(email)
                    .flatMap(profile -> userRepository.findById(profile.getUserId()))
                    .orElse(null);
        }

        if (account == null) {
            response.sendRedirect(redirectBaseUrl + "/signin?oauthError=not_registered");
            return;
        }

        if (!account.isEnabled()) {
            response.sendRedirect(redirectBaseUrl + "/signin?oauthError=disabled");
            return;
        }

        sessionLoginHelper.establish(AuthUser.from(account), request, response);

        String target = switch (account.getRole()) {
            case STUDENT -> "/student";
            case DEPARTMENT_SPOC -> "/spoc";
            case PLACEMENT_ADMIN -> "/admin";
        };
        response.sendRedirect(redirectBaseUrl + target);
    }

    private String firstNonBlank(Object... values) {
        for (Object v : values) {
            if (v != null) {
                String s = v.toString().trim();
                if (!s.isEmpty()) return s;
            }
        }
        return null;
    }
}