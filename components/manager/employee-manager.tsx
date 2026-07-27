"use client"

import { T } from "@/components/translated-text"
import {
  useAppErrorTranslation,
  useAppTranslations,
} from "@/i18n/use-app-translations"

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
import type { AppMessageKey } from "@/i18n/messages"
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

const employeeStatusLabelKeys: Record<EmployeeStatus, AppMessageKey> = {
  unclaimed: "notJoined",
  invited: "emailInviteSent",
  active: "active",
  deactivated: "deactivated",
}

const employeeAccessLabelKeys = {
  manager: "employeeAccessFull",
  editor: "employeeAccessEditing",
  viewer: "employeeAccessReadOnly",
} satisfies Record<EmployeeProfile["accessLevel"], AppMessageKey>

const invitationStatusLabelKeys = {
  "not-sent": "invitationStatusNotSent",
  pending: "invitationStatusPending",
  accepted: "invitationStatusAccepted",
  expired: "invitationStatusExpired",
  revoked: "invitationStatusRevoked",
  failed: "invitationStatusFailed",
} satisfies Record<EmployeeProfile["invitationStatus"], AppMessageKey>

export function EmployeeManager() {
  const t = useAppTranslations()
  const translateError = useAppErrorTranslation()
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
    if (!form.displayName.trim()) return setError(t("addTheEmployeeSName"))
    if (!form.email.trim()) return setError(t("addTheEmployeeSEmail"))
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
      showFeedback(editing === "new" ? "employeeCreated" : "employeeSaved")
      setEditing(null)
    } catch (caught) {
      setError(translateError(caught))
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
      if (!response.ok) throw new Error(result.error ?? "actionFailed")
      if (result.refreshSession) await session?.reload()
      showFeedback(
        action === "reconcile"
          ? "employeeAccessReconciled"
          : action === "invite"
            ? "invitationEmailSent"
            : action === "revoke-invite"
              ? "emailInvitationCanceled"
              : action === "remove"
                ? "employeeRemovedFromThisWorkplace"
                : "employeeAccessUpdated"
      )
      return true
    } catch (caught) {
      setError(translateError(caught))
      return false
    } finally {
      setActionId(null)
    }
  }

  if (!hub?.clerkOrganizationId) {
    return (
      <EmptyState
        icon={Users}
        title="createTheWorkplaceFirst"
        description="useUpgradeActionAboveBeforeAddingEmployeesMessage"
      />
    )
  }

  return (
    <div className="space-y-6">
      <ManagerHeading
        title="employees"
        description="createEmployeeProfilesSendSignDetailsControlMessage"
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
              <T>syncAccess</T>
            </Button>
            <Button onClick={() => openForm("new")}>
              <Plus /> <T>createEmployee</T>
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
            placeholder={t("searchEmployees")}
            className="border border-input pr-3 pl-10"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as EmployeeStatus | "all")}
        >
          <SelectTrigger
            className="w-full border border-input bg-background px-3"
            aria-label={t("filterEmployeesByStatus")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <T>allStatuses</T>
            </SelectItem>
            <SelectItem value="unclaimed">
              <T>notJoined</T>
            </SelectItem>
            <SelectItem value="invited">
              <T>emailInviteSent</T>
            </SelectItem>
            <SelectItem value="active">
              <T>active</T>
            </SelectItem>
            <SelectItem value="deactivated">
              <T>deactivated</T>
            </SelectItem>
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
                        {t(employeeStatusLabelKeys[employee.status])}
                      </Badge>
                      <span aria-hidden="true" className="text-border">
                        |
                      </span>
                      <Badge variant="outline">
                        {t(employeeAccessLabelKeys[employee.accessLevel])}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[employee.jobTitle, employee.department, employee.email]
                        .filter(Boolean)
                        .join(" · ") || t("noAdditionalProfileDetails")}
                    </p>
                    {employee.invitationStatus !== "not-sent" && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <T>emailInvitation</T>{" "}
                        {t(
                          invitationStatusLabelKeys[employee.invitationStatus]
                        )}
                        {employee.invitationError
                          ? ` · ${t("invitationDeliveryFailed")}`
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
                      <T>edit</T>
                    </Button>
                    {employee.status === "deactivated" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={Boolean(actionId)}
                        onClick={() => setRemoveTarget(employee)}
                      >
                        <Trash2 /> <T>remove</T>
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
                          {employee.invitationStatus === "pending" ? (
                            <T>resendEmail</T>
                          ) : (
                            <T>sendEmailInvite</T>
                          )}
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
                        <T>cancelEmailInvite</T>
                      </Button>
                    )}
                    {employee.status !== "deactivated" ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={Boolean(actionId)}
                        onClick={() => setDeactivateTarget(employee)}
                      >
                        <T>deactivate</T>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={Boolean(actionId)}
                        onClick={() => void runAction(employee, "reactivate")}
                      >
                        <T>reactivate</T>
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
          title="noMatchingEmployees"
          description="createProfileChangeCurrentFilters"
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
                <T>{editing === "new" ? "createEmployee" : "editEmployee"}</T>
              </DialogTitle>
              <DialogDescription>
                <T>profileExistBeforeEmployeeCreatesAccount</T>
              </DialogDescription>
            </DialogHeader>
            <div className="my-6 space-y-4">
              <EmployeeField
                label="displayName"
                id="employee-name"
                value={form.displayName}
                onChange={(displayName) => setForm({ ...form, displayName })}
                required
              />
              <EmployeeField
                label="email"
                id="employee-email"
                type="email"
                value={form.email}
                onChange={(email) => setForm({ ...form, email })}
                required
              />
              <EmployeeField
                label="departmentOrTeam"
                id="employee-department"
                value={form.department}
                onChange={(department) => setForm({ ...form, department })}
              />
              <EmployeeField
                label="jobTitle"
                id="employee-title"
                value={form.jobTitle}
                onChange={(jobTitle) => setForm({ ...form, jobTitle })}
              />
              {jobTitles.length > 0 && (
                <div
                  className="flex flex-wrap gap-2"
                  aria-label={t("savedJobTitles")}
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
                <Label htmlFor="employee-access">
                  <T>workhalAccess</T>
                </Label>
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
                      <T>nothingViewPublishedContentOnly</T>
                    </SelectItem>
                    <SelectItem value="editor">
                      <T>editingUpdateExistingContent</T>
                    </SelectItem>
                    <SelectItem value="manager">
                      <T>fullAccessCreateManageAllContent</T>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  <T>
                    fullAccessNotIncludeEmployeesInvitationsWorkplaceMessage
                  </T>
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
                <T>cancel</T>
              </Button>
              <Button type="submit" disabled={pending}>
                <T>saveEmployee</T>
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
              <T>deactivate</T> {deactivateTarget?.displayName}?
            </DialogTitle>
            <DialogDescription>
              <T>
                removesWorkplaceMembershipCancelsPendingEmailInvitationMessage
              </T>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeactivateTarget(null)}
            >
              <T>noKeepActive</T>
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
              <T>yesDeactivate</T>
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
              <T>permanentlyRemove</T> {removeTarget?.displayName}?
            </DialogTitle>
            <DialogDescription>
              <T>
                permanentlyRemovesEmployeeWorkplaceIncludingProfileEmailError
              </T>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemoveTarget(null)}
            >
              <T>noKeepEmployee</T>
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
              <T>yesRemove</T>
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
  label: AppMessageKey
  id: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
}) {
  const t = useAppTranslations()
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {t(label)}
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
