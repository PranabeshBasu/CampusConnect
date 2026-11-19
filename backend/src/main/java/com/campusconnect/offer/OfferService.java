package com.campusconnect.offer;

import com.campusconnect.application.Application;
import com.campusconnect.application.ApplicationRepository;
import com.campusconnect.application.ApplicationStatus;
import com.campusconnect.auth.UserAccount;
import com.campusconnect.auth.UserRepository;
import com.campusconnect.common.ApiException;
import com.campusconnect.company.Company;
import com.campusconnect.company.CompanyRepository;
import com.campusconnect.drive.DriveRepository;
import com.campusconnect.drive.PlacementDrive;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class OfferService {

    private static final Set<String> VALID_STATUSES = Set.of("PENDING", "ACCEPTED", "DECLINED");

    private final OfferRepository offerRepository;
    private final ApplicationRepository applicationRepository;
    private final DriveRepository driveRepository;
    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;

    public OfferService(
            OfferRepository offerRepository,
            ApplicationRepository applicationRepository,
            DriveRepository driveRepository,
            CompanyRepository companyRepository,
            UserRepository userRepository) {
        this.offerRepository = offerRepository;
        this.applicationRepository = applicationRepository;
        this.driveRepository = driveRepository;
        this.companyRepository = companyRepository;
        this.userRepository = userRepository;
    }

    public record OfferRow(
            Long id,
            Long applicationId,
            Long driveId,
            String companyName,
            String driveTitle,
            Long studentUserId,
            String studentName,
            String studentEmail,
            BigDecimal offeredCtcLpa,
            LocalDate joiningDate,
            String offerStatus,
            String notes
    ) {}

    public record UpsertOfferRequest(
            BigDecimal offeredCtcLpa,
            LocalDate joiningDate,
            String offerStatus,
            String notes
    ) {}

    @Transactional
    public OfferRow upsertOffer(Long applicationId, UpsertOfferRequest req) {
        if (req.offeredCtcLpa() == null || req.offeredCtcLpa().compareTo(BigDecimal.ZERO) < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Offered CTC must be 0 or greater.");
        }
        String status = req.offerStatus() == null || req.offerStatus().isBlank()
                ? "PENDING"
                : req.offerStatus().trim().toUpperCase();
        if (!VALID_STATUSES.contains(status)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Offer status must be PENDING, ACCEPTED, or DECLINED.");
        }

        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Application not found."));

        if (app.getStatus() != ApplicationStatus.SELECTED) {
            throw new ApiException(HttpStatus.CONFLICT, "Offers can only be recorded for SELECTED applications.");
        }

        String notes = (req.notes() != null && !req.notes().isBlank()) ? req.notes().trim() : null;
        Offer offer = offerRepository.findByApplicationId(applicationId)
                .map(existing -> {
                    existing.updateDetails(req.offeredCtcLpa(), req.joiningDate(), status, notes);
                    return existing;
                })
                .orElseGet(() -> new Offer(applicationId, req.offeredCtcLpa(), req.joiningDate(), status, notes));

        Offer saved = offerRepository.save(offer);
        return toRow(saved, app);
    }

    @Transactional(readOnly = true)
    public List<OfferRow> listAllOffers() {
        List<Offer> offers = offerRepository.findAll();
        return mapRows(offers);
    }

    @Transactional(readOnly = true)
    public List<OfferRow> listMyOffers(Long studentUserId) {
        List<Offer> all = offerRepository.findAll();
        Map<Long, Application> apps = applicationRepository.findAllById(
                all.stream().map(Offer::getApplicationId).toList()
        ).stream().collect(Collectors.toMap(Application::getId, Function.identity()));

        List<Offer> mine = all.stream()
                .filter(o -> {
                    Application a = apps.get(o.getApplicationId());
                    return a != null && studentUserId.equals(a.getStudentUserId());
                })
                .toList();
        return mapRows(mine);
    }

    @Transactional
    public OfferRow respondToOffer(Long offerId, Long studentUserId, String status) {
        String normalized = status == null ? "" : status.trim().toUpperCase();
        if (!normalized.equals("ACCEPTED") && !normalized.equals("DECLINED")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Response must be ACCEPTED or DECLINED.");
        }

        Offer offer = offerRepository.findById(offerId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Offer not found."));
        Application app = applicationRepository.findById(offer.getApplicationId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Application not found."));

        if (!studentUserId.equals(app.getStudentUserId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "You can only respond to your own offers.");
        }

        offer.setOfferStatus(normalized);
        return toRow(offerRepository.save(offer), app);
    }

    private List<OfferRow> mapRows(List<Offer> offers) {
        if (offers.isEmpty()) return List.of();
        Map<Long, Application> apps = applicationRepository.findAllById(
                offers.stream().map(Offer::getApplicationId).toList()
        ).stream().collect(Collectors.toMap(Application::getId, Function.identity()));

        return offers.stream()
                .filter(o -> apps.containsKey(o.getApplicationId()))
                .map(o -> toRow(o, apps.get(o.getApplicationId())))
                .toList();
    }

    private OfferRow toRow(Offer offer, Application app) {
        PlacementDrive drive = driveRepository.findById(app.getDriveId()).orElse(null);
        Company company = drive != null ? companyRepository.findById(drive.getCompanyId()).orElse(null) : null;
        UserAccount student = userRepository.findById(app.getStudentUserId()).orElse(null);

        return new OfferRow(
                offer.getId(),
                app.getId(),
                app.getDriveId(),
                company != null ? company.getName() : "Company",
                drive != null ? drive.getTitle() : "Role",
                app.getStudentUserId(),
                student != null ? student.getFullName() : "Student",
                student != null ? student.getEmail() : "",
                offer.getOfferedCtcLpa(),
                offer.getJoiningDate(),
                offer.getOfferStatus(),
                offer.getNotes()
        );
    }
}
