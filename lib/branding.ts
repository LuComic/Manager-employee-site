export const SITE_NAME = "workhal"

export function workspaceDocumentTitle(
  currentTitle: string,
  workspaceName: string | null,
  previousWorkspaceName: string | null = null
) {
  const activeName = workspaceName?.trim() || SITE_NAME
  const replaceableNames = [previousWorkspaceName?.trim(), SITE_NAME]

  for (const replaceableName of replaceableNames) {
    if (!replaceableName) continue
    if (currentTitle === replaceableName) return activeName
    if (currentTitle.endsWith(` | ${replaceableName}`)) {
      return `${currentTitle.slice(0, -replaceableName.length)}${activeName}`
    }
  }

  return currentTitle
}
