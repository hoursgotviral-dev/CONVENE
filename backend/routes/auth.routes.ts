import { Router } from "express";
import { prisma } from "../src/lib/db";
import {
  hashPassword,
  comparePassword,
  generateSessionToken,
  verifySessionToken,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  AuthenticatedRequest
} from "../src/lib/auth";

const router = Router();

router.post("/signup", async (req, res) => {
  try {
    const { email, password, displayName, name } = req.body;
    const finalName = displayName || name || "";

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required." });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long." });
    }

    if (!finalName.trim()) {
      return res.status(400).json({ error: "Display name is required." });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return res.status(400).json({ error: "An account with this email address already exists. Please log in." });
    }

    const passwordHash = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        displayName: finalName.trim(),
      },
    });

    const token = generateSessionToken({ userId: newUser.id, email: newUser.email });
    setSessionCookie(res, token);

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        displayName: newUser.displayName,
        createdAt: newUser.createdAt,
      },
    });
  } catch (err: any) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Database error creating account. Please try again." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const trimmedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (!user) {
      return res.status(401).json({
        error: "No account found with this email address. Please switch to the Sign Up tab to create an account.",
      });
    }

    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Incorrect password. Please try again.",
      });
    }

    const token = generateSessionToken({ userId: user.id, email: user.email });
    setSessionCookie(res, token);

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
      },
    });
  } catch (err: any) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Database error verifying credentials. Please try again." });
  }
});

router.post("/logout", (req, res) => {
  clearSessionCookie(res);
  return res.json({ success: true });
});

router.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, displayName: true, createdAt: true },
    });
    if (!user) {
      return res.status(404).json({ error: "User profile not found." });
    }
    return res.json({ success: true, user });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch user profile." });
  }
});

export default router;
