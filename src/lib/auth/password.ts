import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

export function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

export function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export function generateTempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

export const PASSWORD_MIN = 8;

export function passwordIssue(pw: string): "tooShort" | "weak" | null {
  if (pw.length < PASSWORD_MIN) return "tooShort";
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return "weak";
  return null;
}
