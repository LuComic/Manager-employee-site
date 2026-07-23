"use client"

import { useMemo, useState } from "react"
import { useSession } from "@clerk/nextjs"
import {
  Mail,
  Plus,
  RefreshCw,
  Search,
  Trash2,
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
import type { Id } from "@/convex/_generated/dataModel"
import type {
  EmployeeAccessLevel,
  EmployeeProfile,
  EmployeeStatus,
} from "@/lib/operations"

type FormValue = {
  displayName: string
  email: string
  department: string
  jobTitle: string
  accessLevel: EmployeeAccessLevel
}

const emptyForm: FormValue = {
  displayName: "",
  email: "",
  department: "",
  jobTitle: "",
  accessLevel: "viewer",
}

const employeeStatusLabels: Record<EmployeeStatus, string> = {
  unclaimed: "Not joined",
  invited: "Email invite sent",
  active: "Active",
  deactivated: "Deactivated",
}

export function EmployeeManager() {
  const { hub, employees, createEmployee, updateEmployee, showFeedback } =
    useOperations()
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
  const [removeTarget, setRemoveTarget] = useState<EmployeeProfile | null>(null)

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
            accessLevel: employee.accessLevel,
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
        accessLevel: form.accessLevel,
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
    setError("")
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
          : action === "invite"
            ? "Invitation email sent."
            : action === "revoke-invite"
              ? "Email invitation canceled."
              : action === "remove"
                ? "Employee removed from this workplace."
                : "Employee access updated."
      )
      return true
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed")
      return false
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
        description="Create employee profiles, send sign-in details, and control content access."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 hover:text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
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
            <SelectItem value="unclaimed">Not joined</SelectItem>
            <SelectItem value="invited">Email invite sent</SelectItem>
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
            return (
              <Card key={employee.id} size="sm" className="shadow-none">
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <span className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
                    <UserCog className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{employee.displayName}</h3>
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
                        {employeeStatusLabels[employee.status]}
                      </Badge>
                      <span aria-hidden="true" className="text-border">
                        |
                      </span>
                      <Badge variant="outline">
                        {employee.accessLevel === "manager"
                          ? "Full access"
                          : employee.accessLevel === "editor"
                            ? "Editing"
                            : "Read only"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[employee.jobTitle, employee.department, employee.email]
                        .filter(Boolean)
                        .join(" · ") || "No additional profile details"}
                    </p>
                    {employee.invitationStatus !== "not-sent" && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Email invitation: {employee.invitationStatus}
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
                    {employee.status === "deactivated" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={Boolean(actionId)}
                        onClick={() => setRemoveTarget(employee)}
                      >
                        <Trash2 /> Remove
                      </Button>
                    )}
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
                            ? "Resend email"
                            : "Send email invite"}
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
                        Cancel email invite
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
              <div className="space-y-2">
                <Label htmlFor="employee-access">Application access</Label>
                <Select
                  value={form.accessLevel}
                  onValueChange={(value) =>
                    setForm({
                      ...form,
                      accessLevel: value as EmployeeAccessLevel,
                    })
                  }
                >
                  <SelectTrigger
                    id="employee-access"
                    className="w-full border border-input bg-background px-3"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">
                      Nothing - view published content only
                    </SelectItem>
                    <SelectItem value="editor">
                      Editing - update existing content
                    </SelectItem>
                    <SelectItem value="manager">
                      Full access - create and manage all content
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Full access does not include employees, invitations, workplace
                  settings, or access controls.
                </p>
              </div>

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
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Deactivate {deactivateTarget?.displayName}?
            </DialogTitle>
            <DialogDescription>
              This removes their workplace membership, cancels any pending email
              invitation, and preserves their profile and historical event
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
                if (await runAction(deactivateTarget, "deactivate")) {
                  setDeactivateTarget(null)
                }
              }}
            >
              Deactivate employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Permanently remove {removeTarget?.displayName}?
            </DialogTitle>
            <DialogDescription>
              This permanently removes the employee from this workplace,
              including their profile, email invitation, notifications, and all
              event assignments. Their sign-in account and access to any other
              workplaces will not be deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemoveTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={Boolean(actionId)}
              onClick={async () => {
                if (!removeTarget) return
                if (await runAction(removeTarget, "remove")) {
                  setRemoveTarget(null)
                }
              }}
            >
              Permanently remove
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
