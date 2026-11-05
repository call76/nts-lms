-- Additive migration: certificate approval, metadata and lifecycle controls.
ALTER TABLE `Certificate`
  ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN `finalScore` DOUBLE NULL,
  ADD COLUMN `studentPhotoUrl` TEXT NULL,
  ADD COLUMN `internshipTitle` VARCHAR(191) NULL,
  ADD COLUMN `templateName` VARCHAR(191) NULL,
  ADD COLUMN `signaturesJson` LONGTEXT NULL,
  ADD COLUMN `revokedAt` DATETIME(3) NULL,
  ADD COLUMN `revokedReason` TEXT NULL,
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

CREATE INDEX `Certificate_status_issuedAt_idx` ON `Certificate`(`status`, `issuedAt`);

CREATE TABLE `CertificateRequest` (
  `id` VARCHAR(191) NOT NULL,
  `studentId` VARCHAR(191) NOT NULL,
  `moduleId` INTEGER NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `note` TEXT NULL,
  `reviewedById` VARCHAR(191) NULL,
  `reviewedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CertificateRequest_studentId_moduleId_key`(`studentId`, `moduleId`),
  INDEX `CertificateRequest_status_createdAt_idx`(`status`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CertificateRequest_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CertificateRequest_moduleId_fkey` FOREIGN KEY (`moduleId`) REFERENCES `Module`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
