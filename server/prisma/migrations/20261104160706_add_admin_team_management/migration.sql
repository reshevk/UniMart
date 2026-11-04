-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'ADMIN';

-- CreateTable
CREATE TABLE "AdminTeamMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canManageListings" BOOLEAN NOT NULL DEFAULT false,
    "canManageReports" BOOLEAN NOT NULL DEFAULT false,
    "canManageUsers" BOOLEAN NOT NULL DEFAULT false,
    "canManageAnnouncements" BOOLEAN NOT NULL DEFAULT false,
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminTeamMember_userId_key" ON "AdminTeamMember"("userId");

-- AddForeignKey
ALTER TABLE "AdminTeamMember" ADD CONSTRAINT "AdminTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminTeamMember" ADD CONSTRAINT "AdminTeamMember_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
