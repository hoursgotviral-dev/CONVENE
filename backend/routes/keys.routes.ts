import { Router } from "express";
import { prisma } from "../src/lib/db";
import { requireRoomMembership } from "../src/lib/auth";
import { encrypt } from "../src/lib/crypto";

const router = Router();

router.get("/status", requireRoomMembership, async (req: any, res: any) => {
  const roomCode = String(req.query.roomCode || '').trim().toUpperCase();
  if (!roomCode) {
    return res.status(400).json({ error: "roomCode parameter is required." });
  }

  try {
    const room = await prisma.room.findUnique({ where: { code: roomCode } });
    if (!room) {
      return res.status(404).json({ error: "Room not found." });
    }

    const key = await prisma.apiKey.findFirst({
      where: { roomId: room.id },
      orderBy: { createdAt: 'desc' },
    });

    if (key) {
      return res.json({
        connected: true,
        provider: key.provider,
      });
    }

    return res.json({
      connected: false,
      provider: null,
    });
  } catch (err: any) {
    console.error("Error checking key status:", err);
    return res.status(500).json({ error: "Failed to check API key status." });
  }
});

router.post("/", requireRoomMembership, async (req: any, res: any) => {
  const { provider, key, roomCode } = req.body;
  const normalizedCode = String(roomCode || '').trim().toUpperCase();
  if (!normalizedCode) {
    return res.status(400).json({ error: "roomCode parameter is required." });
  }
  if (!provider || !key) {
    return res.status(400).json({ error: "Provider and key are required." });
  }
  if (provider !== "gemini" && provider !== "openai" && provider !== "anthropic") {
    return res.status(400).json({ error: "Invalid provider." });
  }

  try {
    const room = await prisma.room.findUnique({ where: { code: normalizedCode } });
    if (!room) {
      return res.status(404).json({ error: "Room not found." });
    }

    await prisma.apiKey.upsert({
      where: {
        roomId_provider: {
          roomId: room.id,
          provider,
        },
      },
      update: { key: encrypt(key) },
      create: {
        roomId: room.id,
        provider,
        key: encrypt(key),
      },
    });

    return res.json({ success: true, connected: true, provider });
  } catch (err: any) {
    console.error("Error saving API key:", err);
    return res.status(500).json({ error: "Failed to save API key." });
  }
});

router.delete("/", requireRoomMembership, async (req: any, res: any) => {
  const normalizedCode = String(req.query.roomCode || req.body?.roomCode || '').trim().toUpperCase();
  if (!normalizedCode) {
    return res.status(400).json({ error: "roomCode parameter is required." });
  }

  try {
    const room = await prisma.room.findUnique({ where: { code: normalizedCode } });
    if (!room) {
      return res.status(404).json({ error: "Room not found." });
    }

    await prisma.apiKey.deleteMany({
      where: { roomId: room.id },
    });

    return res.json({ success: true, connected: false });
  } catch (err: any) {
    console.error("Error deleting API keys:", err);
    return res.status(500).json({ error: "Failed to disconnect API keys." });
  }
});

export default router;
