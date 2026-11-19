package com.campusconnect.offer;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "offers")
public class Offer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "application_id", nullable = false, unique = true)
    private Long applicationId;

    @Column(name = "offered_ctc_lpa", nullable = false, precision = 6, scale = 2)
    private BigDecimal offeredCtcLpa;

    @Column(name = "joining_date")
    private LocalDate joiningDate;

    @Column(name = "offer_status", nullable = false, length = 16)
    private String offerStatus = "PENDING";

    @Column(length = 500)
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Offer() {
    }

    public Offer(Long applicationId, BigDecimal offeredCtcLpa, LocalDate joiningDate, String offerStatus, String notes) {
        Instant now = Instant.now();
        this.applicationId = applicationId;
        this.offeredCtcLpa = offeredCtcLpa;
        this.joiningDate = joiningDate;
        this.offerStatus = offerStatus != null ? offerStatus : "PENDING";
        this.notes = notes;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public Long getId() { return id; }
    public Long getApplicationId() { return applicationId; }
    public BigDecimal getOfferedCtcLpa() { return offeredCtcLpa; }
    public LocalDate getJoiningDate() { return joiningDate; }
    public String getOfferStatus() { return offerStatus; }
    public String getNotes() { return notes; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void updateDetails(BigDecimal offeredCtcLpa, LocalDate joiningDate, String offerStatus, String notes) {
        this.offeredCtcLpa = offeredCtcLpa;
        this.joiningDate = joiningDate;
        if (offerStatus != null && !offerStatus.isBlank()) {
            this.offerStatus = offerStatus;
        }
        this.notes = notes;
        this.updatedAt = Instant.now();
    }

    public void setOfferStatus(String offerStatus) {
        this.offerStatus = offerStatus;
        this.updatedAt = Instant.now();
    }
}