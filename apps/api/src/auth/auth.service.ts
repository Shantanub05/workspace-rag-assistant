import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { nanoid } from 'nanoid';
import * as argon2 from 'argon2';
import type { User } from '@prisma/client';
import type { AppEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/slug';
import type { LoginDto, RegisterDto } from './dto';

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: User; token: string }> {
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await argon2.hash(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          name: dto.name.trim(),
          passwordHash,
        },
      });

      const workspaceName = `${user.name.split(' ')[0] || 'My'} Workspace`;
      const workspace = await this.prisma.workspace.create({
        data: {
          name: workspaceName,
          slug: `${slugify(workspaceName) || 'workspace'}-${nanoid(6)}`,
          memberships: {
            create: {
              userId: user.id,
              role: 'owner',
            },
          },
        },
      });

      await this.prisma.requestLog.create({
        data: {
          workspaceId: workspace.id,
          operation: 'auth.register',
          latencyMs: 0,
          status: 'success',
        },
      });

      return { user, token: await this.signToken(user) };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('A user with this email already exists.');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<{ user: User; token: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return { user, token: await this.signToken(user) };
  }

  async signToken(user: User): Promise<string> {
    return this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      name: user.name,
    });
  }

  setCookie(res: Response, token: string): void {
    const secure = this.config.get('NODE_ENV') === 'production';
    res.cookie('access_token', token, {
      httpOnly: true,
      secure,
      sameSite: secure ? 'none' : 'lax',
      signed: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  clearCookie(res: Response): void {
    const secure = this.config.get('NODE_ENV') === 'production';
    res.clearCookie('access_token', {
      httpOnly: true,
      secure,
      sameSite: secure ? 'none' : 'lax',
      signed: true,
      path: '/',
    });
  }

  toResponse(user: User): AuthResponse {
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
