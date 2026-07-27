export function assertAdminRemovalIsSafe(
  targetRole: string | undefined,
  organizationAdminCount: number
) {
  if (targetRole === "org:admin" && organizationAdminCount <= 1) {
    throw new Error("lastOrganizationAdminCannotBeRemoved")
  }
}
