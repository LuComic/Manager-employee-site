import type { Appearance } from "@clerk/ui"
import { shadcn } from "@clerk/ui/themes"

const focusRing = "0 0 0 2px color-mix(in oklch, var(--ring) 30%, transparent)"
const floatingSurfaceShadow =
  "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1), 0 0 0 1px color-mix(in oklch, var(--foreground) 10%, transparent)"
const cardShadow =
  "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1), 0 0 0 1px color-mix(in oklch, var(--foreground) 5%, transparent)"

/**
 * Keeps every prebuilt Clerk surface on the same tokens and component rhythm as
 * the app's Base Sera/shadcn UI. Component-specific rules live here so modals
 * opened through `useClerk` receive the same treatment as mounted components.
 */
export const clerkAppearance = {
  theme: shadcn,
  variables: {
    borderRadius: "0rem",
    colorBackground: "var(--card)",
    colorBorder: "var(--border)",
    colorDanger: "var(--destructive)",
    colorForeground: "var(--foreground)",
    colorInput: "var(--background)",
    colorInputForeground: "var(--foreground)",
    colorModalBackdrop: "oklch(0 0 0 / 20%)",
    colorMuted: "var(--muted)",
    colorMutedForeground: "var(--muted-foreground)",
    colorPrimary: "var(--primary)",
    colorPrimaryForeground: "var(--primary-foreground)",
    colorRing: "var(--ring)",
    colorSuccess: "var(--success)",
    colorWarning: "var(--warning)",
    fontFamily: "var(--font-sans)",
    fontFamilyButtons: "var(--font-sans)",
    fontFamilyMono: "var(--font-mono)",
    fontSize: "0.875rem",
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  elements: {
    button: {
      borderRadius: 0,
      fontFamily: "var(--font-sans)",
      fontSize: "0.75rem",
      fontWeight: 600,
      transition:
        "color 150ms, background-color 150ms, border-color 150ms, box-shadow 150ms, transform 150ms",
      "&:focus-visible": {
        boxShadow: focusRing,
        outline: "none",
      },
      "&:active:not(:disabled)": {
        transform: "translateY(1px)",
      },
    },
    cardBox: {
      borderRadius: 0,
      boxShadow: "none",
    },
    card: {
      backgroundColor: "var(--card)",
      border: 0,
      borderRadius: 0,
      boxShadow: cardShadow,
      color: "var(--card-foreground)",
    },
    actionCard: {
      backgroundColor: "var(--background)",
      border: "1px solid var(--border)",
      borderRadius: 0,
      boxShadow: "none",
    },
    headerTitle: {
      color: "var(--foreground)",
      fontSize: "1.125rem",
      fontWeight: 600,
      letterSpacing: "-0.025em",
    },
    headerSubtitle: {
      color: "var(--muted-foreground)",
      fontSize: "0.875rem",
      lineHeight: 1.625,
    },
    formFieldLabel: {
      color: "var(--foreground)",
      fontSize: "0.875rem",
      fontWeight: 500,
    },
    formFieldInput: {
      backgroundColor: "var(--background)",
      border: "1px solid var(--input) !important",
      borderRadius: 0,
      boxShadow: "none !important",
      color: "var(--foreground)",
      fontSize: "0.875rem",
      height: "2.5rem !important",
      maxHeight: "2.5rem !important",
      paddingInline: "0.75rem",
      "&:focus": {
        borderColor: "var(--ring) !important",
        boxShadow: `${focusRing} !important`,
      },
    },
    formButtonPrimary: {
      backgroundColor: "var(--primary)",
      border: "1px solid var(--primary)",
      borderRadius: 0,
      boxShadow: "none",
      color: "var(--primary-foreground)",
      fontSize: "0.75rem",
      fontWeight: 600,
      height: "2.5rem",
      paddingInline: "1.5rem",
      "&:hover": {
        backgroundColor: "color-mix(in oklch, var(--primary) 80%, transparent)",
        borderColor: "color-mix(in oklch, var(--primary) 80%, transparent)",
      },
    },
    socialButtonsBlockButton: {
      backgroundColor: "transparent",
      border: "1px solid var(--border)",
      borderRadius: 0,
      boxShadow: "none",
      color: "var(--foreground)",
      fontSize: "0.75rem",
      fontWeight: 600,
      height: "2.5rem",
      "&:hover": {
        backgroundColor: "var(--muted)",
      },
    },
    alternativeMethodsBlockButton: {
      backgroundColor: "transparent",
      border: "1px solid var(--border)",
      borderRadius: 0,
      boxShadow: "none",
      color: "var(--foreground)",
      fontSize: "0.75rem",
      fontWeight: 600,
      minHeight: "2.5rem",
      "&:hover": {
        backgroundColor: "var(--muted)",
      },
    },
    footerActionLink: {
      color: "var(--primary)",
      fontWeight: 600,
      textDecorationThickness: "1px",
      textUnderlineOffset: "4px",
    },
    footerItem: {
      display: "none",
    },
    formFieldAction: {
      color: "var(--primary)",
      fontWeight: 600,
      textUnderlineOffset: "4px",
    },
    identityPreviewEditButton: {
      color: "var(--primary)",
      fontWeight: 600,
    },
    dividerLine: {
      backgroundColor: "var(--border)",
    },
    dividerText: {
      color: "var(--muted-foreground)",
      fontSize: "0.75rem",
    },
    modalBackdrop: {
      backdropFilter: "blur(4px)",
      backgroundColor: "oklch(0 0 0 / 20%)",
    },
    modalContent: {
      backgroundColor: "var(--popover)",
      borderRadius: 0,
      boxShadow: floatingSurfaceShadow,
      color: "var(--popover-foreground)",
    },
    modalCloseButton: {
      backgroundColor: "var(--secondary)",
      borderRadius: 0,
      color: "var(--secondary-foreground)",
      height: "2.25rem",
      width: "2.25rem",
      "&:hover": {
        backgroundColor:
          "color-mix(in oklch, var(--secondary), var(--foreground) 5%)",
      },
    },
    popoverBox: {
      borderRadius: 0,
    },
    userButtonPopoverCard: {
      backgroundColor: "var(--popover)",
      border: 0,
      borderRadius: 0,
      boxShadow: floatingSurfaceShadow,
      color: "var(--popover-foreground)",
    },
    organizationSwitcherPopoverCard: {
      backgroundColor: "var(--popover)",
      border: 0,
      borderRadius: 0,
      boxShadow: floatingSurfaceShadow,
      color: "var(--popover-foreground)",
    },
    menuList: {
      backgroundColor: "var(--popover)",
      border: 0,
      borderRadius: 0,
      boxShadow: floatingSurfaceShadow,
      color: "var(--popover-foreground)",
      padding: "0.375rem",
    },
    menuItem: {
      borderRadius: 0,
      color: "var(--popover-foreground)",
      fontSize: "0.75rem",
      fontWeight: 500,
      padding: "0.5rem 0.75rem",
      "&:hover": {
        backgroundColor: "var(--accent)",
        color: "var(--accent-foreground)",
      },
    },
    table: {
      borderColor: "var(--border)",
    },
    profileSection: {
      borderColor: "var(--border)",
      borderRadius: 0,
      boxShadow: "none",
    },
    profileSectionPrimaryButton: {
      backgroundColor: "var(--primary)",
      border: "1px solid var(--primary)",
      borderRadius: 0,
      color: "var(--primary-foreground)",
      fontSize: "0.75rem",
      fontWeight: 600,
      minHeight: "2.25rem",
    },
    navbarButton: {
      borderRadius: 0,
      fontSize: "0.75rem",
      fontWeight: 500,
    },
  },
  organizationSwitcher: {
    elements: {
      organizationSwitcherTrigger: {
        backgroundColor: "transparent",
        border: "1px solid transparent",
        borderRadius: 0,
        boxSizing: "border-box",
        color: "var(--foreground)",
        fontSize: "0.75rem",
        fontWeight: 600,
        height: "2.25rem",
        padding: "0.25rem 0.75rem",
        "&:hover": {
          backgroundColor: "var(--muted)",
          borderColor: "var(--muted)",
          color: "var(--foreground)",
        },
        "&[aria-expanded='true']": {
          backgroundColor: "var(--muted)",
          borderColor: "var(--muted)",
          color: "var(--foreground)",
        },
        "&:focus-visible": {
          borderColor: "var(--ring)",
          boxShadow: focusRing,
          outline: "none",
        },
      },
      organizationSwitcherTriggerIcon: {
        color: "var(--foreground)",
        height: "0.875rem",
        marginInlineStart: "0.375rem",
        width: "0.875rem",
      },
      organizationPreviewMainIdentifier: {
        color: "var(--foreground)",
        fontSize: "0.75rem",
        fontWeight: 600,
      },
      organizationPreviewSecondaryIdentifier: {
        color: "var(--muted-foreground)",
        fontSize: "0.75rem",
      },
      organizationSwitcherPopoverActionButton: {
        borderRadius: 0,
        color: "var(--popover-foreground)",
        flex: "0 0 2.5rem !important",
        fontSize: "0.75rem",
        fontWeight: 500,
        height: "2.5rem !important",
        maxHeight: "2.5rem !important",
        minHeight: "2.5rem !important",
        padding: "0.5rem 0.75rem",
        "&:hover": {
          backgroundColor: "var(--accent)",
          color: "var(--accent-foreground)",
        },
      },
      organizationSwitcherPreviewButton: {
        borderRadius: 0,
        fontSize: "0.75rem",
        padding: "0.5rem 0.75rem !important",
        "&:hover": {
          backgroundColor: "var(--accent)",
        },
      },
    },
  },
  userButton: {
    elements: {
      userButtonTrigger: {
        border: "1px solid transparent",
        borderRadius: 0,
        boxSizing: "border-box",
        height: "2.25rem",
        padding: "0.25rem",
        width: "2.25rem",
        "&:hover": {
          backgroundColor: "var(--muted)",
          borderColor: "var(--muted)",
        },
        "&:focus-visible": {
          borderColor: "var(--ring)",
          boxShadow: focusRing,
          outline: "none",
        },
      },
      userButtonAvatarBox: {
        borderRadius: 0,
        height: "1.625rem",
        width: "1.625rem",
      },
      userButtonPopoverActionButton: {
        borderRadius: 0,
        color: "var(--popover-foreground)",
        fontSize: "0.75rem",
        fontWeight: 500,
        minHeight: "2.5rem !important",
        padding: "0.5rem 0.75rem",
        "&:hover": {
          backgroundColor: "var(--accent)",
          color: "var(--accent-foreground)",
        },
      },
    },
  },
} satisfies Appearance
