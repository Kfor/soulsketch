import { createClient } from "@/lib/supabase/client";

const AUTH_TIMEOUT_MS = 10_000;

export class AuthTimeoutError extends Error {
  constructor() {
    super("Authentication timed out. Please check your connection and try again.");
    this.name = "AuthTimeoutError";
  }
}

export async function ensureAnonymousAuth() {
  const auth = async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) return session;

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error(`Anonymous sign-in failed: ${error.message}`);
    return data.session!;
  };

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new AuthTimeoutError()), AUTH_TIMEOUT_MS),
  );

  return Promise.race([auth(), timeout]);
}

export async function linkEmailOTP(email: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw new Error(`OTP send failed: ${error.message}`);
}

export async function verifyOTP(email: string, token: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) throw new Error(`OTP verify failed: ${error.message}`);
  return data;
}

export async function isAnonymousUser(): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.is_anonymous ?? true;
}
