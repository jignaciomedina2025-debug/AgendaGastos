"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/context/AuthContext";

type Mode = "login" | "register";

type LoginValues = {
  email: string;
  password: string;
};

type RegisterValues = {
  name: string;
  email: string;
  password: string;
  familyName: string;
  inviteCode: string;
  joinExisting: boolean;
};

export function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loginForm = useForm<LoginValues>({
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterValues>({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      familyName: "",
      inviteCode: "",
      joinExisting: false,
    },
  });

  const joinExisting = registerForm.watch("joinExisting");

  const onLogin = loginForm.handleSubmit(async (values) => {
    setSubmitting(true);
    setError(null);
    const resultError = await login(values.email, values.password);
    if (resultError) setError(resultError);
    setSubmitting(false);
  });

  const onRegister = registerForm.handleSubmit(async (values) => {
    setSubmitting(true);
    setError(null);
    const resultError = await register({
      name: values.name,
      email: values.email,
      password: values.password,
      familyName: values.joinExisting ? undefined : values.familyName,
      inviteCode: values.joinExisting ? values.inviteCode : undefined,
    });
    if (resultError) setError(resultError);
    setSubmitting(false);
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
          Finanzas Familiares
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-[#14201b]">
          {mode === "login" ? "Inicia sesión" : "Crea tu perfil"}
        </h1>
        <p className="text-sm text-[#5b6b64]">
          Cada persona entra con su cuenta y ve su deuda y la de la familia.
        </p>
      </div>

      <div className="rounded-3xl border border-[#d7e0db] bg-white/95 p-5 shadow-[0_18px_50px_-28px_rgba(15,55,45,0.55)] sm:p-7">
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-[#f3f6f4] p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={[
              "rounded-xl px-3 py-2 text-sm font-medium transition",
              mode === "login"
                ? "bg-white text-[#14201b] shadow-sm"
                : "text-[#5b6b64]",
            ].join(" ")}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            className={[
              "rounded-xl px-3 py-2 text-sm font-medium transition",
              mode === "register"
                ? "bg-white text-[#14201b] shadow-sm"
                : "text-[#5b6b64]",
            ].join(" ")}
          >
            Registrarme
          </button>
        </div>

        {mode === "login" ? (
          <form className="space-y-4" onSubmit={onLogin} noValidate>
            <Field label="Email" error={loginForm.formState.errors.email?.message}>
              <input
                type="email"
                autoComplete="email"
                className={inputClass()}
                {...loginForm.register("email", {
                  required: "Email obligatorio",
                })}
              />
            </Field>
            <Field
              label="Contraseña"
              error={loginForm.formState.errors.password?.message}
            >
              <input
                type="password"
                autoComplete="current-password"
                className={inputClass()}
                {...loginForm.register("password", {
                  required: "Contraseña obligatoria",
                  minLength: { value: 6, message: "Mínimo 6 caracteres" },
                })}
              />
            </Field>
            {error ? <ErrorBanner message={error} /> : null}
            <SubmitButton loading={submitting} label="Entrar" />
          </form>
        ) : (
          <form className="space-y-4" onSubmit={onRegister} noValidate>
            <Field label="Tu nombre" error={registerForm.formState.errors.name?.message}>
              <input
                type="text"
                autoComplete="name"
                className={inputClass()}
                {...registerForm.register("name", {
                  required: "Nombre obligatorio",
                  minLength: { value: 2, message: "Mínimo 2 caracteres" },
                })}
              />
            </Field>
            <Field label="Email" error={registerForm.formState.errors.email?.message}>
              <input
                type="email"
                autoComplete="email"
                className={inputClass()}
                {...registerForm.register("email", {
                  required: "Email obligatorio",
                })}
              />
            </Field>
            <Field
              label="Contraseña"
              error={registerForm.formState.errors.password?.message}
            >
              <input
                type="password"
                autoComplete="new-password"
                className={inputClass()}
                {...registerForm.register("password", {
                  required: "Contraseña obligatoria",
                  minLength: { value: 6, message: "Mínimo 6 caracteres" },
                })}
              />
            </Field>

            <label className="flex items-start gap-3 rounded-2xl border border-[#d7e0db] bg-[#f8fbf9] px-3 py-3">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-teal-700"
                {...registerForm.register("joinExisting")}
              />
              <span className="text-sm text-[#14201b]">
                Ya tengo un código de familia
                <span className="mt-0.5 block text-xs text-[#5b6b64]">
                  Si eres el primero, deja esto desmarcado y crea la familia.
                </span>
              </span>
            </label>

            {joinExisting ? (
              <Field
                label="Código de familia"
                error={registerForm.formState.errors.inviteCode?.message}
              >
                <input
                  type="text"
                  placeholder="Ej. A7K9QM"
                  className={`${inputClass()} uppercase`}
                  {...registerForm.register("inviteCode", {
                    required: "Ingresa el código",
                    minLength: { value: 4, message: "Código inválido" },
                  })}
                />
              </Field>
            ) : (
              <Field
                label="Nombre de la familia"
                hint="Opcional"
                error={registerForm.formState.errors.familyName?.message}
              >
                <input
                  type="text"
                  placeholder="Familia Pérez"
                  className={inputClass()}
                  {...registerForm.register("familyName")}
                />
              </Field>
            )}

            {error ? <ErrorBanner message={error} /> : null}
            <SubmitButton loading={submitting} label="Crear cuenta" />
          </form>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-[#14201b]">{label}</span>
      {children}
      {hint && !error ? <span className="block text-xs text-[#5b6b64]">{hint}</span> : null}
      {error ? <span className="block text-xs text-[#b42318]">{error}</span> : null}
    </label>
  );
}

function inputClass(): string {
  return "w-full rounded-2xl border border-[#d7e0db] bg-white px-3.5 py-3 text-sm text-[#14201b] outline-none transition placeholder:text-[#8a9891] focus:border-teal-600 focus:ring-2 focus:ring-teal-600/25";
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {message}
    </div>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading ? (
        <>
          <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          Espera…
        </>
      ) : (
        label
      )}
    </button>
  );
}
