import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./db";

declare module "next-auth" {
  interface User {
    role: "admin" | "customer";
    tenantId?: string;
    tenantSlug?: string;
  }
  interface Session {
    user: User & {
      id: string;
      email: string;
      name: string;
      role: "admin" | "customer";
      tenantId?: string;
      tenantSlug?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "admin" | "customer";
    tenantId?: string;
    tenantSlug?: string;
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Try admin user first
        const adminUser = await prisma.adminUser.findUnique({
          where: { email: credentials.email },
        });

        if (adminUser) {
          const isValid = await compare(credentials.password, adminUser.passwordHash);
          if (!isValid) return null;
          return {
            id: adminUser.id,
            email: adminUser.email,
            name: adminUser.name,
            role: "admin" as const,
          };
        }

        // Try customer user
        const customerUser = await prisma.customerUser.findUnique({
          where: { email: credentials.email },
          include: { tenant: { select: { id: true, slug: true } } },
        });

        if (customerUser) {
          const isValid = await compare(credentials.password, customerUser.passwordHash);
          if (!isValid) return null;
          return {
            id: customerUser.id,
            email: customerUser.email,
            name: customerUser.name,
            role: "customer" as const,
            tenantId: customerUser.tenant.id,
            tenantSlug: customerUser.tenant.slug,
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.tenantSlug = user.tenantSlug;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.tenantId = token.tenantId;
        session.user.tenantSlug = token.tenantSlug;
      }
      return session;
    },
  },
};
