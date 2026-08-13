export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
        Finanzas Familiares
      </p>
      <h1 className="text-2xl font-semibold text-[#14201b]">Sin conexión</h1>
      <p className="text-sm text-[#5b6b64]">
        Revisa tu red e intenta de nuevo. La app cargará más rápido la próxima vez gracias al
        cache local.
      </p>
    </main>
  );
}
