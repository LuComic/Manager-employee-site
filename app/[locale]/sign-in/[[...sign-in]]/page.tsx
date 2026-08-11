import { SignIn } from "@clerk/nextjs"

export default function SignInPage() {
  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-8 sm:px-6">
      <SignIn />
    </div>
  )
}
