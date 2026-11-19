package com.campusconnect.account;

import com.campusconnect.account.BulkStudentImportService.ImportResult;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/admin/students")
@PreAuthorize("hasRole('PLACEMENT_ADMIN')")
public class BulkStudentImportController {

    private final BulkStudentImportService importService;

    public BulkStudentImportController(BulkStudentImportService importService) {
        this.importService = importService;
    }

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ImportResult importStudents(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "defaultPassword", required = false) String defaultPassword) {
        return importService.importCsv(file, defaultPassword);
    }
}