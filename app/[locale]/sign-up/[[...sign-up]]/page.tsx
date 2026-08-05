import { SignUp } from "@clerk/nextjs"

export default function SignUpPage() {
  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-8 sm:px-6">
      <SignUp />
    </div>
  )
}
