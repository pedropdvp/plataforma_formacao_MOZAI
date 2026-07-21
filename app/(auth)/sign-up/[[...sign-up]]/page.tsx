import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 flex flex-col items-center">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-400">
            MOZAI
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Crie a sua conta e acelere a sua carreira com IA
          </p>
        </div>
        <div className="mt-8">
          <SignUp 
            appearance={{
              variables: {
                colorPrimary: "#6366f1",
                colorBackground: "#0f172a",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
