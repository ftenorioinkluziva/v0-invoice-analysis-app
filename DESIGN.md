---
name: NoteWise
description: Mobile-first Brazilian invoice analysis and price history app.
colors:
  deep-register-bg: "oklch(0.07 0 0)"
  ink-high: "oklch(0.98 0 0)"
  ledger-card: "oklch(0.13 0 0)"
  receipt-popover: "oklch(0.12 0 0)"
  verified-teal: "oklch(0.78 0.16 165)"
  teal-ink: "oklch(0.12 0 0)"
  quiet-panel: "oklch(0.18 0 0)"
  muted-ink: "oklch(0.68 0 0)"
  alert-red: "oklch(0.65 0.2 25)"
  savings-green: "oklch(0.7 0.17 145)"
  caution-yellow: "oklch(0.75 0.15 75)"
  divider: "oklch(0.28 0 0)"
  input-field: "oklch(0.34 0 0)"
  chart-blue: "oklch(0.6 0.15 250)"
typography:
  display:
    fontFamily: "Geist, Geist Fallback, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0"
  headline:
    fontFamily: "Geist, Geist Fallback, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0"
  title:
    fontFamily: "Geist, Geist Fallback, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0"
  body:
    fontFamily: "Geist, Geist Fallback, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "Geist, Geist Fallback, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "0"
  data:
    fontFamily: "Geist Mono, Geist Mono Fallback, monospace"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "0"
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.verified-teal}"
    textColor: "{colors.teal-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.deep-register-bg}"
    textColor: "{colors.ink-high}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
  card-default:
    backgroundColor: "{colors.ledger-card}"
    textColor: "{colors.ink-high}"
    rounded: "{rounded.lg}"
    padding: "24px"
  input-default:
    backgroundColor: "{colors.input-field}"
    textColor: "{colors.ink-high}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "4px 12px"
    height: "36px"
  badge-primary:
    backgroundColor: "{colors.verified-teal}"
    textColor: "{colors.teal-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
---

# Design System: NoteWise

## Overview

NoteWise should feel like a compact ledger that lives on a phone: dark, legible, fast to scan, and built around the next useful action. The system is restrained because the product is task-heavy. Teal is reserved for action, selection, confirmation, and trustworthy data emphasis.

## Rules

- Keep the upload action visible and primary on the dashboard.
- Use verified teal for primary action, active navigation, upload, and chart continuity.
- Use Geist Mono for BRL values and percentages that users compare.
- Pair semantic color with labels or icons for price increases, savings, and errors.
- Avoid glossy gradients, glassmorphism, gradient text, colored side-stripe borders, and oversized marketing blocks.
- Keep mobile cards compact, with clear spacing and predictable repeated row patterns.
