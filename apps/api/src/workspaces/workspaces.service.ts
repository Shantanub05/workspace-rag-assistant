import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { WorkspaceRole } from '@prisma/client';
import { nanoid } from 'nanoid';
import type { WorkspaceDto } from '@workspace-rag/shared';
import { slugify } from '../common/slug';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<WorkspaceDto[]> {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((membership) => ({
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      role: membership.role,
      createdAt: membership.workspace.createdAt.toISOString(),
    }));
  }

  async create(userId: string, name: string): Promise<WorkspaceDto> {
    const cleanName = name.trim();
    const slugBase = slugify(cleanName) || 'workspace';
    const workspace = await this.prisma.workspace.create({
      data: {
        name: cleanName,
        slug: `${slugBase}-${nanoid(6)}`,
        memberships: {
          create: {
            userId,
            role: 'owner',
          },
        },
      },
      include: {
        memberships: {
          where: { userId },
          take: 1,
        },
      },
    });

    const role = workspace.memberships[0]?.role ?? 'owner';
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      role,
      createdAt: workspace.createdAt.toISOString(),
    };
  }

  async assertMember(userId: string, workspaceId: string): Promise<WorkspaceRole> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      select: { role: true },
    });

    if (!membership) {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true },
      });
      if (!workspace) {
        throw new NotFoundException('Workspace not found.');
      }
      throw new ForbiddenException('You are not a member of this workspace.');
    }

    return membership.role;
  }
}
