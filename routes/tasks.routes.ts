import { Router } from "express";
import { prisma } from "../src/lib/db";
import { requireRoomMembership } from "../src/lib/auth";
import { broadcastToRoom } from "../server";

const router = Router();

router.get("/", requireRoomMembership, async (req: any, res: any) => {
  const roomCode = String(req.query.roomCode || '').trim().toUpperCase();
  if (!roomCode) {
    return res.status(400).json({ error: "roomCode parameter is required." });
  }

  try {
    const room = await prisma.room.findUnique({ where: { code: roomCode } });
    if (!room) {
      return res.status(404).json({ error: "Room not found." });
    }

    const dbTasks = await prisma.task.findMany({
      where: { roomId: room.id },
    });

    const tasks = dbTasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      assigneeId: t.assigneeId || undefined,
      column: t.column as any,
      source: t.source as any,
      agentReasoning: t.agentReasoning || undefined,
      isApprovedByHuman: t.isApprovedByHuman ?? undefined,
      subtasks: (t.subtasks as any) || [],
    }));

    return res.json(tasks);
  } catch (err: any) {
    console.error("Error loading tasks:", err);
    return res.status(500).json({ error: "Failed to load tasks." });
  }
});

router.post("/", requireRoomMembership, async (req: any, res: any) => {
  const { roomCode, title, description, column, source, assigneeId, agentReasoning, isApprovedByHuman, subtasks } = req.body;
  const normalizedCode = String(roomCode || '').trim().toUpperCase();
  if (!normalizedCode) {
    return res.status(400).json({ error: "roomCode parameter is required." });
  }

  try {
    const room = await prisma.room.findUnique({ where: { code: normalizedCode } });
    if (!room) {
      return res.status(404).json({ error: "Room not found." });
    }

    await prisma.task.create({
      data: {
        roomId: room.id,
        title: title || "New Task",
        description: description || "",
        assigneeId: assigneeId || null,
        column: column || "todo",
        source: source || "human",
        agentReasoning: agentReasoning || null,
        isApprovedByHuman: isApprovedByHuman ?? null,
        subtasks: subtasks || [],
      },
    });

    const allDbTasks = await prisma.task.findMany({ where: { roomId: room.id } });
    const tasks = allDbTasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      assigneeId: t.assigneeId || undefined,
      column: t.column as any,
      source: t.source as any,
      agentReasoning: t.agentReasoning || undefined,
      isApprovedByHuman: t.isApprovedByHuman ?? undefined,
      subtasks: (t.subtasks as any) || [],
    }));

    broadcastToRoom(normalizedCode, { type: 'TASK_MUTATION', tasks });
    return res.json({ success: true, tasks });
  } catch (err: any) {
    console.error("Error creating task:", err);
    return res.status(500).json({ error: "Failed to create task." });
  }
});

router.put("/:id", requireRoomMembership, async (req: any, res: any) => {
  const { id } = req.params;
  const normalizedCode = String(req.body.roomCode || req.query.roomCode || '').trim().toUpperCase();
  if (!normalizedCode) {
    return res.status(400).json({ error: "roomCode parameter is required." });
  }

  try {
    const room = await prisma.room.findUnique({ where: { code: normalizedCode } });
    if (!room) {
      return res.status(404).json({ error: "Room not found." });
    }

    const { title, description, column, source, assigneeId, agentReasoning, isApprovedByHuman, subtasks } = req.body;

    await prisma.task.update({
      where: { id, roomId: req.roomContext.roomId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(column !== undefined && { column }),
        ...(source !== undefined && { source }),
        ...(assigneeId !== undefined && { assigneeId }),
        ...(agentReasoning !== undefined && { agentReasoning }),
        ...(isApprovedByHuman !== undefined && { isApprovedByHuman }),
        ...(subtasks !== undefined && { subtasks }),
      },
    });

    const allDbTasks = await prisma.task.findMany({ where: { roomId: room.id } });
    const tasks = allDbTasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      assigneeId: t.assigneeId || undefined,
      column: t.column as any,
      source: t.source as any,
      agentReasoning: t.agentReasoning || undefined,
      isApprovedByHuman: t.isApprovedByHuman ?? undefined,
      subtasks: (t.subtasks as any) || [],
    }));

    broadcastToRoom(normalizedCode, { type: 'TASK_MUTATION', tasks });
    return res.json({ success: true, tasks });
  } catch (err: any) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: "Task not found in this room." });
    }
    console.error("Error updating task:", err);
    return res.status(500).json({ error: "Failed to update task." });
  }
});

router.delete("/:id", requireRoomMembership, async (req: any, res: any) => {
  const { id } = req.params;
  const normalizedCode = String(req.query.roomCode || req.body?.roomCode || '').trim().toUpperCase();
  if (!normalizedCode) {
    return res.status(400).json({ error: "roomCode parameter is required." });
  }

  try {
    const room = await prisma.room.findUnique({ where: { code: normalizedCode } });
    if (!room) {
      return res.status(404).json({ error: "Room not found." });
    }

    await prisma.task.delete({ where: { id, roomId: req.roomContext.roomId } });

    const allDbTasks = await prisma.task.findMany({ where: { roomId: room.id } });
    const tasks = allDbTasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      assigneeId: t.assigneeId || undefined,
      column: t.column as any,
      source: t.source as any,
      agentReasoning: t.agentReasoning || undefined,
      isApprovedByHuman: t.isApprovedByHuman ?? undefined,
      subtasks: (t.subtasks as any) || [],
    }));

    broadcastToRoom(normalizedCode, { type: 'TASK_MUTATION', tasks });
    return res.json({ success: true, tasks });
  } catch (err: any) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: "Task not found in this room." });
    }
    console.error("Error deleting task:", err);
    return res.status(500).json({ error: "Failed to delete task." });
  }
});

export default router;
