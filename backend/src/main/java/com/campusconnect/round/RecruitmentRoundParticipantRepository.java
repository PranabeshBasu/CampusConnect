package com.campusconnect.round;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecruitmentRoundParticipantRepository
        extends JpaRepository<RecruitmentRoundParticipant, Long> {

    List<RecruitmentRoundParticipant> findByRoundIdOrderByIdAsc(Long roundId);

    List<RecruitmentRoundParticipant> findByApplicationIdIn(Collection<Long> applicationIds);

    Optional<RecruitmentRoundParticipant> findByRoundIdAndApplicationId(
            Long roundId, Long applicationId);
}