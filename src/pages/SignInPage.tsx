import { GoogleLogo } from "@phosphor-icons/react";
import { useAuth } from "../auth/AuthProvider";
import { isConfigured } from "../lib/supabase";

export default function SignInPage() {
  const { signInWithGoogle, error } = useAuth();
  return (
    <div className="mx-auto flex min-h-dvh max-w-[420px] flex-col justify-center px-6 py-10">
      <h1 className="text-4xl font-semibold tracking-tight">Homie</h1>
      <p className="mt-2 text-muted">Tasks, meals, stock and spending for your home, in one place.</p>
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={!isConfigured}
        className="pressable mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent px-5 font-medium text-on-accent disabled:opacity-50"
      >
        <GoogleLogo size={20} weight="bold" aria-hidden="true" />
        Continue with Google
      </button>
      {!isConfigured ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          Homie is missing its connection settings. Check the .env file or the GitHub secrets.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          Sign-in did not work: {error}
        </p>
      ) : null}
    </div>
  );
}
