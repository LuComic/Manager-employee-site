import { type PointerEvent, useEffect, useRef, useState } from "react"

const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)"
const WINDOW_EDGE_GAP = 16
const WINDOW_WIDTH = 448
const WINDOW_MAX_HEIGHT = 544

type WindowPosition = {
  x: number
  y: number
}

type DragState = {
  pointerId: number
  offsetX: number
  offsetY: number
}

type StoredWindowPreferences = {
  isOpen: boolean
  position: WindowPosition | null
}

function preferencesKey(hubId: string) {
  return `workhal:worker-notes:${hubId}`
}

function readWindowPreferences(hubId: string): StoredWindowPreferences {
  const fallback = { isOpen: false, position: null }
  try {
    const stored = JSON.parse(
      localStorage.getItem(preferencesKey(hubId)) ?? "null"
    ) as {
      isOpen?: unknown
      position?: { x?: unknown; y?: unknown } | null
    } | null
    const position =
      stored?.position &&
      typeof stored.position.x === "number" &&
      Number.isFinite(stored.position.x) &&
      typeof stored.position.y === "number" &&
      Number.isFinite(stored.position.y)
        ? clampWindowPosition(
            stored.position.x,
            stored.position.y,
            WINDOW_WIDTH,
            Math.min(
              WINDOW_MAX_HEIGHT,
              window.innerHeight - WINDOW_EDGE_GAP * 2
            )
          )
        : null
    return {
      isOpen: stored?.isOpen === true,
      position,
    }
  } catch {
    return fallback
  }
}

function clampWindowPosition(
  x: number,
  y: number,
  width: number,
  height: number
): WindowPosition {
  return {
    x: Math.min(
      Math.max(WINDOW_EDGE_GAP, x),
      Math.max(WINDOW_EDGE_GAP, window.innerWidth - width - WINDOW_EDGE_GAP)
    ),
    y: Math.min(
      Math.max(WINDOW_EDGE_GAP, y),
      Math.max(WINDOW_EDGE_GAP, window.innerHeight - height - WINDOW_EDGE_GAP)
    ),
  }
}

export function useWorkerNotesWindow(activeHubId: string | undefined) {
  const [isDesktop, setIsDesktop] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<WindowPosition | null>(null)
  const [restoredHubId, setRestoredHubId] = useState<string | null>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)

  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP_MEDIA_QUERY)
    const updateDesktop = () => {
      setIsDesktop(desktop.matches)
    }
    updateDesktop()
    desktop.addEventListener("change", updateDesktop)
    return () => desktop.removeEventListener("change", updateDesktop)
  }, [])

  useEffect(() => {
    if (!activeHubId) return
    const preferences = readWindowPreferences(activeHubId)
    const timeout = window.setTimeout(() => {
      setIsOpen(preferences.isOpen)
      setPosition(preferences.position)
      setRestoredHubId(activeHubId)
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [activeHubId])

  useEffect(() => {
    if (!activeHubId || restoredHubId !== activeHubId) return
    try {
      localStorage.setItem(
        preferencesKey(activeHubId),
        JSON.stringify({ isOpen, position } satisfies StoredWindowPreferences)
      )
    } catch {
      // Storage can be disabled; window state should still work for this visit.
    }
  }, [activeHubId, isOpen, position, restoredHubId])

  useEffect(() => {
    if (!isOpen) return
    const handleResize = () => {
      const panel = windowRef.current
      if (!panel) return
      const rect = panel.getBoundingClientRect()
      setPosition(
        clampWindowPosition(rect.left, rect.top, rect.width, rect.height)
      )
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [isOpen])

  function startDragging(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !windowRef.current) return
    const rect = windowRef.current.getBoundingClientRect()
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    }
    setPosition({ x: rect.left, y: rect.top })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveWindow(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    const panel = windowRef.current
    if (!drag || drag.pointerId !== event.pointerId || !panel) return
    setPosition(
      clampWindowPosition(
        event.clientX - drag.offsetX,
        event.clientY - drag.offsetY,
        panel.offsetWidth,
        panel.offsetHeight
      )
    )
  }

  function stopDragging(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return {
    isDesktop,
    isOpen,
    setIsOpen,
    position,
    restored: restoredHubId === activeHubId,
    windowRef,
    startDragging,
    moveWindow,
    stopDragging,
  }
}
