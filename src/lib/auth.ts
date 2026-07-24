import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './db';
const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required and must not be empty");
}
const TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function generateSessionToken(payload: { userId: string; email: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifySessionToken(token: string): { userId: string; email: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    return decoded;
  } catch (err) {
    return null;
  }
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie('samanvay_session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: TOKEN_MAX_AGE,
    path: '/',
  });
}

export function clearSessionCookie(res: Response) {
  res.cookie('samanvay_session', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 0,
    path: '/',
  });
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token = req.cookies?.samanvay_session;

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired session token. Please log in again.' });
  }

  req.user = payload;
  next();
}

export interface RoomAuthenticatedRequest extends Request {
  roomContext?: {
    roomId: string;
    userId: string;
  };
}

export function issueRoomSessionCookie(res: Response, { roomId, roomCode, userId }: { roomId: string, roomCode: string, userId: string }) {
  const token = jwt.sign({ roomId, roomCode, userId }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie(`samanvay_room_${roomCode}`, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: TOKEN_MAX_AGE,
    path: '/',
  });
}

export async function verifyRoomCookie(cookieHeader: string | undefined, roomCode: string): Promise<{ roomId: string; userId: string } | null> {
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const cookieName = `samanvay_room_${roomCode}=`;
  const tokenCookie = cookies.find(c => c.startsWith(cookieName));
  if (!tokenCookie) return null;
  
  const token = tokenCookie.substring(cookieName.length);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { roomId: string; roomCode: string; userId: string };
    
    if (decoded.roomCode !== roomCode) {
      return null;
    }

    const member = await prisma.roomMember.findFirst({
      where: { roomId: decoded.roomId, userId: decoded.userId, status: 'active' },
    });

    if (!member) {
      return null;
    }

    return { roomId: decoded.roomId, userId: decoded.userId };
  } catch (err) {
    return null;
  }
}

export async function requireRoomMembership(req: RoomAuthenticatedRequest, res: Response, next: NextFunction) {
  const roomCode = req.params.roomCode || req.body.roomCode || req.query.roomCode;
  
  if (!roomCode || typeof roomCode !== 'string') {
    return res.status(400).json({ error: "roomCode is required." });
  }

  const context = await verifyRoomCookie(req.headers.cookie, roomCode);
  if (!context) {
    return res.status(403).json({ error: "You are not a member of this room." });
  }

  req.roomContext = context;
  next();
}
