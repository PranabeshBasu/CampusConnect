package com.campusconnect.storage;

import com.campusconnect.common.ApiException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class LocalStorageService implements StorageService {

    private final Path rootDir;

    public LocalStorageService(@Value("${app.storage.local-dir:uploads}") String localDir) {
        this.rootDir = Path.of(localDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.rootDir);
        } catch (IOException e) {
            throw new IllegalStateException("Could not initialize local storage directory", e);
        }
    }

    @Override
    public String store(String folder, String filename, InputStream content) {
        String safeName = filename == null ? "file" : filename.replaceAll("[^a-zA-Z0-9._-]", "_");
        String key = folder + "/" + UUID.randomUUID() + "_" + safeName;
        Path target = rootDir.resolve(key).normalize();
        if (!target.startsWith(rootDir)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid storage path.");
        }
        try {
            Files.createDirectories(target.getParent());
            Files.copy(content, target, StandardCopyOption.REPLACE_EXISTING);
            return key;
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to store file.");
        }
    }

    @Override
    public byte[] load(String storageKey) {
        Path target = rootDir.resolve(storageKey).normalize();
        if (!target.startsWith(rootDir) || !Files.exists(target)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Document file not found.");
        }
        try {
            return Files.readAllBytes(target);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to read document.");
        }
    }

    @Override
    public void delete(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) return;
        Path target = rootDir.resolve(storageKey).normalize();
        if (target.startsWith(rootDir)) {
            try {
                Files.deleteIfExists(target);
            } catch (IOException ignored) {
                // Best-effort cleanup
            }
        }
    }
}