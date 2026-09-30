// @vitest-environment jsdom
import { StrictMode, useState } from "react"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  authenticated: true,
  pathname: "/manager",
  auth: { sessionId: "session-a", orgId: null as string | null },
  connect: vi.fn(),
  clerk: {
    session: {
      id: "session-a",
      lastActiveOrganizationId: null as string | null,
    },
    user: { reload: vi.fn() },
    setActive: vi.fn(),
  },
}))
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => mocks.auth,
  useClerk: () => mocks.clerk,
}))
vi.mock("convex/react", () => ({
  useAction: () => mocks.connect,
  useConvexAuth: () => ({ isAuthenticated: mocks.authenticated }),
}))
vi.mock("@/i18n/navigation", () => ({ usePathname: () => mocks.pathname }))
vi.mock("@/i18n/use-app-translations", () => ({
  useAppTranslations: () => (key: string) => key,
}))

import { AccountAccessGate } from "./account-access-gate"

type Workplaces = { organizationId: string; hubSlug: string }[]
function deferred() {
  let resolve!: (value: Workplaces) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<Workplaces>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
function Content() {
  const [count, setCount] = useState(0)
  return (
    <button onClick={() => setCount(count + 1)}>
      Workplace content {count}
    </button>
  )
}
function Page() {
  return (
    <AccountAccessGate>
      <Content />
    </AccountAccessGate>
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.authenticated = true
  mocks.pathname = "/manager"
  mocks.auth.sessionId = "session-a"
  mocks.auth.orgId = null
  mocks.clerk.session.id = "session-a"
  mocks.clerk.session.lastActiveOrganizationId = null
  mocks.connect.mockResolvedValue([])
  mocks.clerk.user.reload.mockResolvedValue(undefined)
  mocks.clerk.setActive.mockResolvedValue(undefined)
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("account connection recovery", () => {
  test("pending and failed connections preserve a usable page and its state", async () => {
    const request = deferred()
    mocks.connect.mockReturnValue(request.promise)
    render(<Page />)
    expect(screen.getByRole("status").textContent).toBe(
      "connectingYourWorkplace"
    )
    fireEvent.click(screen.getByText("Workplace content 0"))
    await act(async () =>
      request.reject(
        new Error("Could not find public function for betaClerk:connectAccount")
      )
    )
    expect(screen.getByRole("alert").textContent).toBe("couldNotConnectAccount")
    expect(screen.getByText("Workplace content 1")).toBeDefined()
    expect(console.error).toHaveBeenCalled()
  })

  test("retry recovers the connection without remounting the workplace", async () => {
    mocks.connect.mockRejectedValueOnce(new Error("Backend unavailable"))
    render(<Page />)
    await screen.findByRole("alert")
    fireEvent.click(screen.getByText("Workplace content 0"))
    fireEvent.click(screen.getByRole("button", { name: "tryAgain" }))
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull())
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByText("Workplace content 1")).toBeDefined()
    expect(mocks.connect).toHaveBeenCalledTimes(2)
  })

  test("verified workplace connections activate the first workplace for a personal session", async () => {
    mocks.connect.mockResolvedValue([
      { organizationId: "org-new", hubSlug: "workplace" },
    ])
    render(<Page />)
    await waitFor(() =>
      expect(mocks.clerk.setActive).toHaveBeenCalledWith({
        organization: "org-new",
      })
    )
    expect(mocks.clerk.user.reload).toHaveBeenCalledTimes(1)
    expect(mocks.connect).toHaveBeenCalledWith({})
  })

  test("organization activation and hook updates do not repeat reconciliation", async () => {
    mocks.connect.mockResolvedValue([
      { organizationId: "org-new", hubSlug: "workplace" },
    ])
    const view = render(<Page />)
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull())
    mocks.auth.orgId = "org-new"
    mocks.clerk.session.lastActiveOrganizationId = "org-new"
    view.rerender(<Page />)
    expect(mocks.connect).toHaveBeenCalledTimes(1)
  })

  test("a workplace selected while connection is pending is respected", async () => {
    const request = deferred()
    mocks.connect.mockReturnValue(request.promise)
    const view = render(<Page />)
    mocks.auth.orgId = "org-selected"
    mocks.clerk.session.lastActiveOrganizationId = "org-selected"
    view.rerender(<Page />)
    await act(async () =>
      request.resolve([{ organizationId: "org-first", hubSlug: "first" }])
    )
    expect(mocks.clerk.setActive).not.toHaveBeenCalled()
    expect(mocks.connect).toHaveBeenCalledTimes(1)
  })

  test("React Strict Mode shares a single connection request", async () => {
    const request = deferred()
    mocks.connect.mockReturnValue(request.promise)
    render(
      <StrictMode>
        <Page />
      </StrictMode>
    )
    await act(async () => request.resolve([]))
    expect(mocks.connect).toHaveBeenCalledTimes(1)
    expect(mocks.clerk.user.reload).toHaveBeenCalledTimes(1)
  })

  test("a stale sign-in cannot activate an organization after the account changes", async () => {
    const oldRequest = deferred()
    mocks.connect.mockReturnValueOnce(oldRequest.promise)
    const view = render(<Page />)
    mocks.auth.sessionId = "session-b"
    mocks.clerk.session.id = "session-b"
    view.rerender(<Page />)
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull())
    await act(async () =>
      oldRequest.resolve([{ organizationId: "org-old", hubSlug: "old" }])
    )
    expect(mocks.clerk.setActive).not.toHaveBeenCalled()
    expect(mocks.clerk.user.reload).toHaveBeenCalledTimes(1)
    expect(mocks.connect).toHaveBeenCalledTimes(2)
  })

  test("Clerk reload failure also preserves existing access and allows retry", async () => {
    mocks.clerk.user.reload.mockRejectedValueOnce(
      new Error("Clerk temporarily unavailable")
    )
    render(<Page />)
    await screen.findByRole("alert")
    expect(screen.getByText("Workplace content 0")).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: "tryAgain" }))
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull())
    expect(mocks.clerk.user.reload).toHaveBeenCalledTimes(2)
  })

  test.each(["/sign-in", "/sign-up", "/invitation/complete"])(
    "does not interfere with %s",
    (pathname) => {
      mocks.pathname = pathname
      render(<Page />)
      expect(screen.getByText("Workplace content 0")).toBeDefined()
      expect(mocks.connect).not.toHaveBeenCalled()
    }
  )

  test("signed-out guests keep their access without reconciliation", () => {
    mocks.authenticated = false
    render(<Page />)
    expect(screen.getByText("Workplace content 0")).toBeDefined()
    expect(mocks.connect).not.toHaveBeenCalled()
  })
})
