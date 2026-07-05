import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await argon2.hash('WorkspaceRag!2026');
  const user = await prisma.user.upsert({
    where: { email: 'reviewer@example.com' },
    update: {
      name: 'Reviewer',
      passwordHash,
    },
    create: {
      email: 'reviewer@example.com',
      name: 'Reviewer',
      passwordHash,
    },
  });

  await ensureWorkspace(user.id, 'Atlas Research', 'atlas-research');
  await ensureWorkspace(user.id, 'Beacon Ops', 'beacon-ops');
}

async function ensureWorkspace(userId: string, name: string, slug: string): Promise<void> {
  const workspace = await prisma.workspace.upsert({
    where: { slug },
    update: { name },
    create: { name, slug },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId,
      },
    },
    update: { role: 'owner' },
    create: {
      workspaceId: workspace.id,
      userId,
      role: 'owner',
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
