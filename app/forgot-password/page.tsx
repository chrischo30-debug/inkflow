import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/app/actions/auth";
import Link from "next/link";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const sent = message?.toLowerCase().includes("check your email");

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-surface">
      <div className="hidden md:flex md:basis-2/5 lg:basis-[38%] shrink-0 flex-col justify-between bg-surface-container-low p-10 lg:p-14 border-r border-outline-variant/20 relative overflow-hidden">
        <div className="absolute inset-0 bg-surface-dim mix-blend-multiply opacity-5 pointer-events-none" />
        <div className="z-10 flex items-center gap-4">
          <img src="/logo.png" alt="FlashBooker logo" className="block w-24 h-24 object-contain drop-shadow-sm -translate-y-3" />
          <h1 className="text-4xl lg:text-5xl font-heading font-medium tracking-tighter text-on-surface leading-none">FlashBooker</h1>
        </div>
        <div className="z-10">
          <div className="h-1 w-12 bg-primary mb-6" />
          <p className="text-xl font-heading text-on-surface-variant max-w-sm leading-relaxed">
            A booking management app designed for tattoo artists for faster, simpler appointments.
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center px-8 py-12 sm:px-12 md:px-16 lg:px-24 relative xl:max-w-2xl">
        <div className="md:hidden absolute top-8 left-8 flex items-center gap-2">
          <img src="/logo.png" alt="FlashBooker logo" className="block w-11 h-11 object-contain drop-shadow-sm" />
          <span className="text-lg font-heading font-bold tracking-tight leading-none">FlashBooker</span>
        </div>

        <div className="w-full mt-20 md:mt-0">
          <h2 className="text-3xl font-heading tracking-tight mb-2">Reset your password</h2>
          <p className="text-on-surface-variant mb-12">
            Enter your email and we&apos;ll send you a link to set a new password.
          </p>

          {sent ? (
            <div className="p-4 bg-surface-container rounded-xl border border-outline-variant/20 text-sm text-on-surface">
              {message}
            </div>
          ) : (
            <form className="flex flex-col w-full gap-6" action={resetPassword}>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-sans tracking-wide text-on-surface-variant" htmlFor="email">
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-6 focus-visible:ring-0 focus-visible:border-primary shadow-none transition-colors"
                />
              </div>

              <Button
                type="submit"
                className="w-full mt-4 h-auto py-3 text-sm font-medium rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-sm hover:opacity-90 transition-opacity"
              >
                Send Reset Link
              </Button>

              {message && !sent && (
                <p className="mt-2 p-4 bg-error-container/30 text-error text-center text-sm rounded-lg border-b border-error">
                  {message}
                </p>
              )}
            </form>
          )}

          <p className="text-sm text-center text-on-surface-variant mt-8">
            <Link href="/login" className="text-primary font-medium hover:underline underline-offset-4">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
