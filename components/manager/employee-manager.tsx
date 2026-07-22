"use client"

import { useMemo, useState } from "react"
import { useOrganization, useSession } from "@clerk/nextjs"
import { useQuery } from "convex/react"
import {
  Copy,
  Link2,
  Mail,
  Plus,
  RefreshCw,
  Search,
  UserCog,
  Users,
} from "lucide-react"

import { ManagerHeading } from "@/components/manager/manager-heading"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { EmployeeProfile, EmployeeStatus } from "@/lib/operations"

type FormValue = {
  displayName: string
  email: string
  department: string
  jobTitle: string
}

const emptyForm: FormValue = {
  displayName: "",
  email: "",
  department: "",
  jobTitle: "",
}

export function EmployeeManager() {
  const {
    hub,
    employees,
    createEmployee,
    updateEmployee,
    createEmployeeClaimLink,
    revokeEmployeeClaimLink,
    showFeedback,
  } = useOperations()
  const { memberships } = useOrganization({ memberships: { pageSize: 20 } })
  const { session } = useSession()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<EmployeeStatus | "all">("all")
  const [editing, setEditing] = useState<EmployeeProfile | "new" | null>(null)
  const [form, setForm] = useState<FormValue>(emptyForm)
  const [pending, setPending] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [deactivateTarget, setDeactivateTarget] =
    useState<EmployeeProfile | null>(null)
  const [claimProfile, setClaimProfile] = useState<EmployeeProfile | null>(null)
  const [claimNow, setClaimNow] = useState(0)
  const [claim, setClaim] = useState<{
    url: string
    claimLinkId: Id<"employeeClaimLinks">
  } | null>(null)
  const claimLinks = useQuery(
    api.employees.listClaimLinks,
    claimProfile
      ? { profileId: claimProfile.id as Id<"employeeProfiles"> }
      : "skip"
  )

  const roles = useMemo(
    () =>
      new Map(
        (memberships?.data ?? []).flatMap((membership) => {
          const userId = membership.publicUserData?.userId
          return userId ? [[userId, membership.role] as const] : []
        })
      ),
    [memberships?.data]
  )
  const visible = employees.filter((employee) => {
    const matchesQuery =
      `${employee.displayName} ${employee.email ?? ""} ${employee.department ?? ""} ${employee.jobTitle ?? ""}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase())
    return matchesQuery && (status === "all" || employee.status === status)
  })
  const jobTitles = useMemo(() => {
    const titles = new Map<string, string>()
    for (const employee of employees) {
      const title = employee.jobTitle?.trim()
      if (title) titles.set(title.toLocaleLowerCase(), title)
    }
    return [...titles.values()].sort((left, right) => left.localeCompare(right))
  }, [employees])

  function openForm(employee: EmployeeProfile | "new") {
    setEditing(employee)
    setError("")
    setForm(
      employee === "new"
        ? emptyForm
        : {
            displayName: employee.displayName,
            email: employee.email ?? "",
            department: employee.department ?? "",
            jobTitle: employee.jobTitle ?? "",
          }
    )
  }

  async function save() {
    if (!form.displayName.trim()) return setError("Add the employee’s name.")
    if (!form.email.trim()) return setError("Add the employee’s email.")
    setPending(true)
    setError("")
    try {
      const value = {
        displayName: form.displayName.trim(),
        email: form.email.trim() || undefined,
        department: form.department.trim() || undefined,
        jobTitle: form.jobTitle.trim() || undefined,
      }
      if (editing === "new") await createEmployee(value)
      else if (editing) {
        await updateEmployee(editing.id as Id<"employeeProfiles">, value)
      }
      showFeedback(editing === "new" ? "Employee created." : "Employee saved.")
      setEditing(null)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message.replace(/^.*Uncaught Error: /, "")
          : "Could not save employee"
      )
    } finally {
      setPending(false)
    }
  }

  async function runAction(employee: EmployeeProfile | null, action: string) {
    setActionId(employee ? `${employee.id}:${action}` : action)
    try {
      const response = await fetch(
        action === "invite" || action === "revoke-invite"
          ? "/api/organization/invitations"
          : "/api/organization/employees",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action:
              action === "invite"
                ? "send"
                : action === "revoke-invite"
                  ? "revoke"
                  : action,
            profileId: employee?.id,
          }),
        }
      )
      const result = (await response.json()) as {
        error?: string
        refreshSession?: boolean
      }
      if (!response.ok) throw new Error(result.error ?? "Action failed")
      if (result.refreshSession) await session?.reload()
      showFeedback(
        action === "reconcile"
          ? "Employee access reconciled."
          : "Employee access updated."
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed")
    } finally {
      setActionId(null)
    }
  }

  async function createClaim(employee: EmployeeProfile) {
    setActionId(`${employee.id}:claim`)
    try {
      const result = await createEmployeeClaimLink(
        employee.id as Id<"employeeProfiles">,
        Date.now() + 7 * 24 * 60 * 60 * 1000
      )
      const url = `${window.location.origin}/claim#claim=${encodeURIComponent(result.credential)}`
      setClaimNow(Date.now())
      setClaimProfile(employee)
      setClaim({ url, claimLinkId: result.claimLinkId })
    } finally {
      setActionId(null)
    }
  }

  if (!hub?.clerkOrganizationId) {
    return (
      <EmptyState
        icon={Users}
        title="Create the workplace first"
        description="Use the upgrade action above before adding employees or invitations."
      />
    )
  }

  return (
    <div className="space-y-6">
      <ManagerHeading
        title="Employees"
        description="Create workplace profiles, invite employees, manage roles, and control access."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={Boolean(actionId)}
              onClick={() => void runAction(null, "reconcile")}
            >
              <RefreshCw
                className={actionId === "reconcile" ? "animate-spin" : ""}
              />{" "}
              Reconcile access
            </Button>
            <Button onClick={() => openForm("new")}>
              <Plus /> New employee
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 border bg-background p-4 sm:grid-cols-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search employees…"
            className="border border-input pr-3 pl-10"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as EmployeeStatus | "all")}
        >
          <SelectTrigger
            className="w-full border border-input bg-background px-3"
            aria-label="Filter employees by status"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="unclaimed">Unclaimed</SelectItem>
            <SelectItem value="invited">Invited</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="deactivated">Deactivated</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {visible.length ? (
        <div className="space-y-4">
          {visible.map((employee) => {
            const role = employee.clerkUserId
              ? roles.get(employee.clerkUserId)
              : undefined
            return (
              <Card key={employee.id} size="sm" className="shadow-none">
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <span className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
                    <UserCog className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{employee.displayName}</h3>
                      {role && (
                        <>
                          <span aria-hidden="true" className="text-border">
                            |
                          </span>
                          <Badge variant="outline">
                            {role === "org:admin" ? "Manager" : "Member"}
                          </Badge>
                        </>
                      )}
                      <span aria-hidden="true" className="text-border">
                        |
                      </span>
                      <Badge
                        className={
                          employee.status === "active"
                            ? "text-success"
                            : employee.status === "invited"
                              ? "text-info"
                              : employee.status === "unclaimed"
                                ? "text-warning"
                                : "text-danger"
                        }
                      >
                        {employee.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[employee.jobTitle, employee.department, employee.email]
                        .filter(Boolean)
                        .join(" · ") || "No additional profile details"}
                    </p>
                    {employee.invitationStatus !== "not-sent" && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Invitation: {employee.invitationStatus}
                        {employee.invitationError
                          ? ` · ${employee.invitationError}`
                          : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openForm(employee)}
                    >
                      Edit
                    </Button>
                    {employee.email &&
                      employee.status !== "active" &&
                      employee.status !== "deactivated" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={Boolean(actionId)}
                          onClick={() => void runAction(employee, "invite")}
                        >
                          <Mail />{" "}
                          {employee.invitationStatus === "pending"
                            ? "Resend"
                            : "Invite"}
                        </Button>
                      )}
                    {employee.invitationStatus === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={Boolean(actionId)}
                        onClick={() =>
                          void runAction(employee, "revoke-invite")
                        }
                      >
                        Revoke invite
                      </Button>
                    )}
                    {(employee.status === "unclaimed" ||
                      employee.status === "invited") && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={Boolean(actionId)}
                        onClick={() => {
                          setClaim(null)
                          setClaimNow(Date.now())
                          setClaimProfile(employee)
                        }}
                      >
                        <Link2 /> Claim links
                      </Button>
                    )}
                    {employee.clerkUserId &&
                      role !== "org:admin" &&
                      employee.status === "active" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={Boolean(actionId)}
                          onClick={() => void runAction(employee, "promote")}
                        >
                          Promote
                        </Button>
                      )}
                    {employee.clerkUserId && role === "org:admin" && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={Boolean(actionId)}
                        onClick={() => void runAction(employee, "demote")}
                      >
                        Demote
                      </Button>
                    )}
                    {employee.status !== "deactivated" ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={Boolean(actionId)}
                        onClick={() => setDeactivateTarget(employee)}
                      >
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={Boolean(actionId)}
                        onClick={() => void runAction(employee, "reactivate")}
                      >
                        Reactivate
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="No matching employees"
          description="Create a profile or change the current filters."
        />
      )}

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {editing === "new" ? "Create employee" : "Edit employee"}
              </DialogTitle>
              <DialogDescription>
                The profile can exist before the employee creates an account.
              </DialogDescription>
            </DialogHeader>
            <div className="my-6 space-y-4">
              <EmployeeField
                label="Display name"
                id="employee-name"
                value={form.displayName}
                onChange={(displayName) => setForm({ ...form, displayName })}
                required
              />
              <EmployeeField
                label="Email"
                id="employee-email"
                type="email"
                value={form.email}
                onChange={(email) => setForm({ ...form, email })}
                required
              />
              <EmployeeField
                label="Department or team"
                id="employee-department"
                value={form.department}
                onChange={(department) => setForm({ ...form, department })}
              />
              <EmployeeField
                label="Job title"
                id="employee-title"
                value={form.jobTitle}
                onChange={(jobTitle) => setForm({ ...form, jobTitle })}
              />
              {jobTitles.length > 0 && (
                <div
                  className="flex flex-wrap gap-2"
                  aria-label="Saved job titles"
                >
                  {jobTitles.map((jobTitle) => {
                    const selected =
                      form.jobTitle.trim().toLocaleLowerCase() ===
                      jobTitle.toLocaleLowerCase()
                    return (
                      <Button
                        key={jobTitle.toLocaleLowerCase()}
                        type="button"
                        size="xs"
                        variant={selected ? "default" : "outline"}
                        className={selected ? undefined : "bg-background"}
                        aria-pressed={selected}
                        onClick={() =>
                          setForm({
                            ...form,
                            jobTitle: selected ? "" : jobTitle,
                          })
                        }
                      >
                        {jobTitle}
                      </Button>
                    )
                  })}
                </div>
              )}
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                Save employee
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(claimProfile)}
        onOpenChange={(open) => {
          if (!open) {
            setClaim(null)
            setClaimProfile(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Personal claim links</DialogTitle>
            <DialogDescription>
              Links are single-use and employee-specific. Send a newly generated
              link only to {claimProfile?.displayName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {claim ? (
              <div className="space-y-2 border p-3">
                <Input
                  readOnly
                  value={claim.url}
                  className="border border-input px-3 font-mono text-xs"
                />
                <Button
                  type="button"
                  className="w-full"
                  onClick={async () => {
                    await navigator.clipboard.writeText(claim.url)
                    showFeedback("Claim link copied.")
                  }}
                >
                  <Copy /> Copy new claim link
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                className="w-full"
                disabled={Boolean(actionId)}
                onClick={() => claimProfile && void createClaim(claimProfile)}
              >
                <Link2 /> Generate seven-day claim link
              </Button>
            )}
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {claimLinks === undefined ? (
                <p className="text-sm text-muted-foreground">
                  Loading claim history…
                </p>
              ) : claimLinks.length ? (
                claimLinks.map((link) => {
                  const state = link.consumedAt
                    ? "consumed"
                    : link.revokedAt
                      ? "revoked"
                      : link.expiresAt <= claimNow
                        ? "expired"
                        : "active"
                  return (
                    <div
                      key={link._id}
                      className="flex items-center justify-between gap-3 border p-3 text-sm"
                    >
                      <span>
                        <span className="font-medium">{state}</span>
                        <span className="block text-xs text-muted-foreground">
                          Created {new Date(link.createdAt).toLocaleString()}
                        </span>
                      </span>
                      {state === "active" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={async () => {
                            await revokeEmployeeClaimLink(link._id)
                            if (claim?.claimLinkId === link._id) setClaim(null)
                            showFeedback("Claim link revoked.")
                          }}
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  )
                })
              ) : (
                <p className="text-sm text-muted-foreground">
                  No claim links created yet.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setClaim(null)
                setClaimProfile(null)
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Deactivate {deactivateTarget?.displayName}?
            </DialogTitle>
            <DialogDescription>
              This removes their workplace membership, revokes pending access
              links, and preserves their profile and historical event
              assignments.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeactivateTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={Boolean(actionId)}
              onClick={async () => {
                if (!deactivateTarget) return
                await runAction(deactivateTarget, "deactivate")
                setDeactivateTarget(null)
              }}
            >
              Deactivate employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EmployeeField({
  label,
  id,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string
  id: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="-ml-1 text-xs text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="border border-input px-3"
      />
    </div>
  )
}
