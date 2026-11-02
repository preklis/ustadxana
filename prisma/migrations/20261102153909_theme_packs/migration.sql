-- CreateTable
CREATE TABLE "ThemePack" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "author" TEXT,
    "description" TEXT,
    "builtIn" BOOLEAN NOT NULL DEFAULT false,
    "css" TEXT NOT NULL DEFAULT '',
    "defaults" JSONB NOT NULL,
    "custom" JSONB,
    "screenshot" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThemePack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ThemePack_slug_key" ON "ThemePack"("slug");
