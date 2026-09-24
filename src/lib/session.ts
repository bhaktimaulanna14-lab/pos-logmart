import { jwtVerify, SignJWT } from "jose";

const secretKey = process.env.JWT_SECRET || "logmart_super_secret_key_12345";
const key = new TextEncoder().encode(secretKey);

export type SessionPayload = {
  id: string;
  name: string;
  username: string;
  role: string;
};

export async function encrypt(payload: SessionPayload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(key);
}

export async function decrypt(input: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(input, key, {
      algorithms: ["HS256"],
    });
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

import { cookies } from "next/headers";

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("pos_session")?.value;
  if (!sessionCookie) return null;
  return await decrypt(sessionCookie);
}
