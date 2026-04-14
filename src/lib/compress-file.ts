// ============================================================
// src/lib/compress-file.ts
// Client-side file compression sesuai FSD:
// - Image (JPG/PNG): max-width 1280px, quality 0.8, max 2MB
// - PDF: langsung return tanpa kompresi
// ============================================================

import imageCompression from 'browser-image-compression'

export interface CompressionResult {
  file: File
  originalSize: number
  compressedSize: number
  wasCompressed: boolean
}

const IMAGE_COMPRESSION_OPTIONS = {
  maxSizeMB: 2,           // Maksimal 2MB
  maxWidthOrHeight: 1280, // Resize ke max 1280px sesuai FSD
  useWebWorker: true,
  initialQuality: 0.8,    // Quality 0.8 sesuai FSD
  fileType: undefined,    // Pertahankan tipe asli (jpg/png)
}

/**
 * Kompresi gambar JPG/PNG, bypass untuk PDF.
 * Lempar error jika PDF melebihi 2MB (gambar dikompresi hingga batas).
 */
export async function compressFile(file: File): Promise<CompressionResult> {
  const originalSize = file.size

  // PDF tidak dikompresi — langsung validasi ukuran
  if (file.type === 'application/pdf') {
    if (originalSize > 2 * 1024 * 1024) {
      throw new Error(`File PDF melebihi batas 2MB (ukuran: ${formatBytes(originalSize)})`)
    }
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      wasCompressed: false,
    }
  }

  // Kompresi gambar
  if (file.type === 'image/jpeg' || file.type === 'image/png') {
    try {
      const compressedFile = await imageCompression(file, IMAGE_COMPRESSION_OPTIONS)
      if (compressedFile.size > 2 * 1024 * 1024) {
        throw new Error(`Gambar masih di atas 2MB setelah kompresi (${formatBytes(compressedFile.size)})`)
      }
      return {
        file: compressedFile,
        originalSize,
        compressedSize: compressedFile.size,
        wasCompressed: compressedFile.size < originalSize,
      }
    } catch {
      throw new Error('Gagal mengompresi gambar. Coba file lain.')
    }
  }

  throw new Error('Tipe file tidak didukung. Gunakan JPG, PNG, atau PDF.')
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
