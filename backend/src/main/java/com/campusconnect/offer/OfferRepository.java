package com.campusconnect.offer;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface OfferRepository extends JpaRepository<Offer, Long> {
    Optional<Offer> findByApplicationId(Long applicationId);
}