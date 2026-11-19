package com.campusconnect.student;

import com.campusconnect.auth.AuthUser;
import com.campusconnect.common.ApiException;
import com.campusconnect.storage.StorageService;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1")
public class StudentDocumentController {

    private static final long MAX_BYTES = 5 * 1024 * 1024;
    private static final Set<String> ALLOWED_TYPES = Set.of(
            "application/pdf", "image/jpeg", "image/png");

    public record DocumentMeta(StudentDocumentType docType, String fileName, String contentType,
                               long sizeBytes, Instant uploadedAt) {
        static DocumentMeta from(StudentDocument d) {
            return new DocumentMeta(d.getDocType(), d.getFileName(), d.getContentType(),
                    d.getSizeBytes(), d.getUploadedAt());
        }
    }

    private final StudentDocumentRepository docs;
    private final StorageService storage;

    public StudentDocumentController(StudentDocumentRepository docs, StorageService storage) {
        this.docs = docs;
        this.storage = storage;
    }

    @GetMapping("/students/me/documents")
    @PreAuthorize("hasRole('STUDENT')")
    public List<DocumentMeta> listMine(@AuthenticationPrincipal AuthUser me) {
        return docs.findByUserId(me.id()).stream().map(DocumentMeta::from).toList();
    }

    @PostMapping("/students/me/documents/{docType}")
    @PreAuthorize("hasRole('STUDENT')")
    @Transactional
    public DocumentMeta upload(@AuthenticationPrincipal AuthUser me,
                               @PathVariable StudentDocumentType docType,
                               @RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Choose a file to upload.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "File size must be 5 MB or less.");
        }
        String ct = file.getContentType() == null ? "" : file.getContentType();
        if (!ALLOWED_TYPES.contains(ct)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Only PDF, JPG, or PNG files are allowed.");
        }

        String key;
        try {
            key = storage.store("students/" + me.id() + "/" + docType.name(), file.getOriginalFilename(), file.getInputStream());
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not read uploaded file.");
        }

        StudentDocument existing = docs.findByUserIdAndDocType(me.id(), docType).orElse(null);
        if (existing != null) {
            storage.delete(existing.getStorageKey());
            existing.replace(file.getOriginalFilename(), ct, file.getSize(), key);
            return DocumentMeta.from(docs.save(existing));
        }

        StudentDocument created = new StudentDocument(me.id(), docType, file.getOriginalFilename(), ct, file.getSize(), key);
        return DocumentMeta.from(docs.save(created));
    }

    @GetMapping("/students/me/documents/{docType}/file")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<byte[]> viewMine(@AuthenticationPrincipal AuthUser me,
                                           @PathVariable StudentDocumentType docType) {
        return serveDocument(me.id(), docType);
    }

    @DeleteMapping("/students/me/documents/{docType}")
    @PreAuthorize("hasRole('STUDENT')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteMine(@AuthenticationPrincipal AuthUser me,
                           @PathVariable StudentDocumentType docType) {
        docs.findByUserIdAndDocType(me.id(), docType).ifPresent(d -> {
            storage.delete(d.getStorageKey());
            docs.delete(d);
        });
    }

    @GetMapping("/spoc/students/{userId}/documents")
    @PreAuthorize("hasAnyRole('DEPARTMENT_SPOC','PLACEMENT_ADMIN')")
    public List<DocumentMeta> listForStaff(@PathVariable Long userId) {
        return docs.findByUserId(userId).stream().map(DocumentMeta::from).toList();
    }

    @GetMapping("/spoc/students/{userId}/documents/{docType}/file")
    @PreAuthorize("hasAnyRole('DEPARTMENT_SPOC','PLACEMENT_ADMIN')")
    public ResponseEntity<byte[]> viewForStaff(@PathVariable Long userId,
                                               @PathVariable StudentDocumentType docType) {
        return serveDocument(userId, docType);
    }

    private ResponseEntity<byte[]> serveDocument(Long userId, StudentDocumentType docType) {
        StudentDocument d = docs.findByUserIdAndDocType(userId, docType)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Document not found."));
        byte[] bytes = storage.load(d.getStorageKey());
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(d.getContentType()));
        headers.setContentDisposition(ContentDisposition.inline().filename(d.getFileName()).build());
        return new ResponseEntity<>(bytes, headers, HttpStatus.OK);
    }
}