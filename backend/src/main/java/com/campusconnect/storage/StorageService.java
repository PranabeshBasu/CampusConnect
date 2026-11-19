package com.campusconnect.storage;

import java.io.InputStream;

public interface StorageService {
    String store(String folder, String filename, InputStream content);
    byte[] load(String storageKey);
    void delete(String storageKey);
}