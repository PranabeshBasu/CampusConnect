package com.campusconnect.round;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecruitmentRoundRepository extends JpaRepository<RecruitmentRound, Long> {

    List<RecruitmentRound> findByDriveIdOrderBySequenceNumberAsc(Long driveId);

    List<RecruitmentRound> findByDriveIdInOrderBySequenceNumberAsc(Collection<Long> driveIds);

    boolean existsByDriveIdAndSequenceNumber(Long driveId, Integer sequenceNumber);
}