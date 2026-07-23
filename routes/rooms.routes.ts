import { Router } from "express";
import { prisma } from "../src/lib/db";
import {
  issueRoomSessionCookie,
  verifySessionToken
} from "../src/lib/auth";
import { TeamMember } from "../src/types";

const router = Router();

// Helper for generating unique room codes
async function generateUniqueRoomCode(): Promise<string> {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let attempts = 0;
  while (attempts < 100) {
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const existing = await prisma.room.findUnique({ where: { code } });
    if (!existing) return code;
    attempts++;
  }
  throw new Error("Unable to generate unique room code");
}

router.post("/", async (req, res) => {
  try {
    const { action, roomCode, displayName, createdBy } = req.body;
    const userDisplayName = displayName || createdBy || "Anonymous Developer";
    const authUserEmail = req.cookies?.samanvay_session ? verifySessionToken(req.cookies.samanvay_session)?.email : null;

    if (!action || (action !== "create" && action !== "join")) {
      return res.status(400).json({ error: "Action must be 'create' or 'join'." });
    }

    let user = authUserEmail
      ? await prisma.user.findUnique({ where: { email: authUserEmail } })
      : null;

    if (!user) {
      const fallbackEmail = `${userDisplayName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'dev'}@dev.samanvay.local`;
      user = await prisma.user.upsert({
        where: { email: fallbackEmail },
        update: { displayName: userDisplayName },
        create: {
          email: fallbackEmail,
          passwordHash: "external_session",
          displayName: userDisplayName,
        },
      });
    }

    if (action === "create") {
      const code = await generateUniqueRoomCode();
      const room = await prisma.room.create({
        data: {
          code,
          createdBy: userDisplayName,
        },
      });

      await prisma.roomMember.create({
        data: {
          roomId: room.id,
          userId: user.id,
          status: "active",
        },
      });

      issueRoomSessionCookie(res, { roomId: room.id, roomCode: room.code, userId: user.id });

      return res.status(201).json({
        success: true,
        room: {
          id: room.id,
          code: room.code,
          created_at: room.createdAt.toISOString(),
          created_by: room.createdBy,
        },
      });
    }

    if (action === "join") {
      if (!roomCode || typeof roomCode !== "string") {
        return res.status(400).json({ error: "roomCode is required to join a room." });
      }

      const normalizedCode = roomCode.trim().toUpperCase();
      const room = await prisma.room.findUnique({
        where: { code: normalizedCode },
      });

      if (!room) {
        return res.status(404).json({
          exists: false,
          error: "Room not found — check the code and try again.",
        });
      }

      const existingMember = await prisma.roomMember.findFirst({
        where: { roomId: room.id, userId: user.id },
      });

      if (existingMember) {
        await prisma.roomMember.update({
          where: { id: existingMember.id },
          data: { status: "active", joinedAt: new Date() },
        });
      } else {
        await prisma.roomMember.create({
          data: {
            roomId: room.id,
            userId: user.id,
            status: "active",
          },
        });
      }

      await prisma.room.update({
        where: { id: room.id },
        data: { lastActiveAt: new Date() },
      });

      issueRoomSessionCookie(res, { roomId: room.id, roomCode: room.code, userId: user.id });

      return res.json({
        success: true,
        exists: true,
        room: {
          id: room.id,
          code: room.code,
          created_at: room.createdAt.toISOString(),
          created_by: room.createdBy,
        },
      });
    }
  } catch (err: any) {
    console.error("Room API error:", err);
    return res.status(500).json({ error: "Failed to process room request." });
  }
});

router.get("/:code/members", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const room = await prisma.room.findUnique({
      where: { code },
    });

    if (!room) {
      return res.status(404).json({ error: "Room not found." });
    }

    const members = await prisma.roomMember.findMany({
      where: { roomId: room.id },
    });

    const userIds = members.map((m) => m.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const avatarColors = [
      'bg-indigo-300 text-indigo-950',
      'bg-emerald-300 text-emerald-950',
      'bg-cyan-300 text-cyan-950',
      'bg-amber-300 text-amber-950',
      'bg-purple-300 text-purple-950',
      'bg-rose-300 text-rose-950',
    ];

    const teamMembers: TeamMember[] = members.map((member, index) => {
      const user = userMap.get(member.userId);
      const name = user?.displayName || user?.email.split('@')[0] || 'Member';
      const isCreator = user?.displayName === room.createdBy || user?.email === room.createdBy;

      return {
        id: member.id,
        name,
        role: isCreator ? 'Lead Architect' : 'Collaborator',
        avatarColor: avatarColors[index % avatarColors.length],
        status: (member.status === 'idle' || member.status === 'offline') ? member.status : 'active',
      };
    });

    return res.json({ success: true, members: teamMembers });
  } catch (err: any) {
    console.error("Room members fetch error:", err);
    return res.status(500).json({ error: "Failed to fetch room members." });
  }
});

export default router;
