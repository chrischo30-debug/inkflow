import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signIn } from "@/app/actions/auth"
import Link from "next/link"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message: string }>
}) {
  const { message } = await searchParams;

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-surface">
      
      {/* Brand Panel - Editorial Left Side */}
      <div className="hidden md:flex md:basis-2/5 lg:basis-[38%] shrink-0 flex-col justify-between bg-surface-container-low p-10 lg:p-14 border-r border-outline-variant/20 relative overflow-hidden">
        {/* Subtle texture/noise overlay for depth without true shadows */}
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

      {/* Form Panel - Functional Right Side */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 sm:px-10 relative">
        <div className="md:hidden absolute top-8 left-8 flex items-center gap-2">
          <img src="/logo.png" alt="FlashBooker logo" className="block w-11 h-11 object-contain drop-shadow-sm" />
          <span className="text-lg font-heading font-bold tracking-tight leading-none">FlashBooker</span>
        </div>

        <div className="w-full max-w-md mt-20 md:mt-0">
          <h2 className="text-3xl font-heading tracking-tight mb-2">Welcome back</h2>
          <p className="text-on-surface-variant mb-8">Log in to manage your bookings and clients.</p>

          <form className="animate-in flex flex-col w-full gap-5 text-foreground" action={signIn}>

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-sans tracking-wide text-on-surface-variant" htmlFor="email">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-5 focus-visible:ring-0 focus-visible:border-primary shadow-none transition-colors"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-sans tracking-wide text-on-surface-variant" htmlFor="password">
                  Password
                </Label>
                <Link href="/forgot-password" className="text-xs text-on-surface-variant hover:text-primary transition-colors underline-offset-4 hover:underline">
                  Forgot?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                name="password"
                required
                className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-5 focus-visible:ring-0 focus-visible:border-primary shadow-none transition-colors"
              />
            </div>

            <Button type="submit" className="w-full mt-2 h-auto py-3 text-sm font-medium rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-sm hover:opacity-90 transition-opacity">
              Sign in
            </Button>

            {message && (
              <p className="mt-2 p-3 bg-error-container/30 text-error text-center text-sm rounded-lg border-b border-error">
                {message}
              </p>
            )}

            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-outline-variant/30" />
              <span className="text-xs text-on-surface-variant/60">OR</span>
              <div className="flex-1 h-px bg-outline-variant/30" />
            </div>

            <p className="text-sm text-center text-on-surface-variant">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-primary font-medium hover:underline underline-offset-4">
                Sign up
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
