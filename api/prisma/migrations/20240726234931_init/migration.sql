-- CreateEnum
CREATE TYPE "PodType" AS ENUM ('CODE', 'SCOPE', 'DECK', 'WYSIWYG', 'MD', 'REPL');

-- CreateTable
CREATE TABLE "Post" (
    "id" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" STRING NOT NULL,
    "content" STRING,
    "published" BOOL NOT NULL DEFAULT false,
    "authorId" STRING NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" STRING NOT NULL,
    "bio" STRING,
    "userId" STRING NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" STRING NOT NULL,
    "email" STRING NOT NULL,
    "username" STRING,
    "firstname" STRING NOT NULL,
    "lastname" STRING NOT NULL,
    "hashedPassword" STRING,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRepoData" (
    "userId" STRING NOT NULL,
    "repoId" STRING NOT NULL,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dummyCount" INT4 NOT NULL DEFAULT 0,

    CONSTRAINT "UserRepoData_pkey" PRIMARY KEY ("userId","repoId")
);

-- CreateTable
CREATE TABLE "Repo" (
    "id" STRING NOT NULL,
    "name" STRING,
    "userId" STRING NOT NULL,
    "public" BOOL NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yDocBlob" BYTES,

    CONSTRAINT "Repo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Edge" (
    "sourceId" STRING NOT NULL,
    "targetId" STRING NOT NULL,
    "repoId" STRING,

    CONSTRAINT "Edge_pkey" PRIMARY KEY ("sourceId","targetId")
);

-- CreateTable
CREATE TABLE "Pod" (
    "id" STRING NOT NULL,
    "parentId" STRING,
    "x" FLOAT8 NOT NULL DEFAULT 0,
    "y" FLOAT8 NOT NULL DEFAULT 0,
    "width" FLOAT8 NOT NULL DEFAULT 0,
    "height" FLOAT8 NOT NULL DEFAULT 0,
    "index" INT4 NOT NULL,
    "content" STRING,
    "githead" STRING,
    "staged" STRING,
    "column" INT4 NOT NULL DEFAULT 1,
    "fold" BOOL NOT NULL DEFAULT false,
    "thundar" BOOL NOT NULL DEFAULT false,
    "utility" BOOL NOT NULL DEFAULT false,
    "name" STRING,
    "lang" STRING,
    "type" "PodType" NOT NULL,
    "result" STRING,
    "stdout" STRING,
    "error" STRING,
    "imports" STRING,
    "exports" STRING,
    "midports" STRING,
    "reexports" STRING,
    "repoId" STRING NOT NULL,

    CONSTRAINT "Pod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_COLLABORATOR" (
    "A" STRING NOT NULL,
    "B" STRING NOT NULL
);

-- CreateTable
CREATE TABLE "_STAR" (
    "A" STRING NOT NULL,
    "B" STRING NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "_COLLABORATOR_AB_unique" ON "_COLLABORATOR"("A", "B");

-- CreateIndex
CREATE INDEX "_COLLABORATOR_B_index" ON "_COLLABORATOR"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_STAR_AB_unique" ON "_STAR"("A", "B");

-- CreateIndex
CREATE INDEX "_STAR_B_index" ON "_STAR"("B");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRepoData" ADD CONSTRAINT "UserRepoData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRepoData" ADD CONSTRAINT "UserRepoData_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repo" ADD CONSTRAINT "Repo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edge" ADD CONSTRAINT "Edge_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Pod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edge" ADD CONSTRAINT "Edge_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Pod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edge" ADD CONSTRAINT "Edge_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pod" ADD CONSTRAINT "Pod_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Pod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pod" ADD CONSTRAINT "Pod_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_COLLABORATOR" ADD CONSTRAINT "_COLLABORATOR_A_fkey" FOREIGN KEY ("A") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_COLLABORATOR" ADD CONSTRAINT "_COLLABORATOR_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_STAR" ADD CONSTRAINT "_STAR_A_fkey" FOREIGN KEY ("A") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_STAR" ADD CONSTRAINT "_STAR_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
