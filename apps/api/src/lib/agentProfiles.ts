import { prisma } from "./prisma.js";

/** Ensure legacy and newly registered accounts have a usable default persona. */
export async function getOrCreateDefaultAgent(userId: string) {
  const existing = await prisma.agentProfile.findFirst({
    where: { userId, isDefault: true },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  try {
    const named = await prisma.agentProfile.findUnique({
      where: { userId_name: { userId, name: "Default Agent" } },
    });
    if (named) {
      return prisma.agentProfile.update({ where: { id: named.id }, data: { isDefault: true } });
    }
    return await prisma.agentProfile.create({
      data: {
        userId,
        name: "Default Agent",
        isDefault: true,
        instructions: "Be helpful, accurate, and clear. Ask before making consequential changes.",
      },
    });
  } catch (error: any) {
    // Two first-time requests may race. The per-user name constraint makes the
    // second request recover by reading the row created by the first.
    if (error?.code === "P2002") {
      const recovered = await prisma.agentProfile.findFirst({ where: { userId, isDefault: true } });
      if (recovered) return recovered;
    }
    throw error;
  }
}
