import type { SupabaseClient } from "@supabase/supabase-js";

export async function signInWithPassword(
  supabase: SupabaseClient,
  email: string,
  password: string,
) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithPassword(
  supabase: SupabaseClient,
  email: string,
  password: string,
  emailRedirectTo: string,
) {
  return supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });
}

export async function resendSignupConfirmation(
  supabase: SupabaseClient,
  email: string,
  emailRedirectTo: string,
) {
  return supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo },
  });
}

export async function signOut(supabase: SupabaseClient) {
  return supabase.auth.signOut();
}
