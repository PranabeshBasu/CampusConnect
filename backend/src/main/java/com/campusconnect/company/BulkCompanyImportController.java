package com.campusconnect.company;

import com.campusconnect.company.BulkCompanyImportService.ImportResult;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/admin/companies")
@PreAuthorize("hasRole('PLACEMENT_ADMIN')")
public class BulkCompanyImportController {

    private final BulkCompanyImportService importer;

    public BulkCompanyImportController(BulkCompanyImportService importer) {
        this.importer = importer;
    }

    @PostMapping("/import")
    public ImportResult importCsv(@RequestParam("file") MultipartFile file) {
        return importer.importCsv(file);
    }
}
