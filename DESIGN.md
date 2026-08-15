---
name: NoteWise
description: Mobile-first Brazilian invoice analysis and price history app.
colors:
  deep-register-bg: "oklch(0.18 0.008 250)"
  ink-high: "oklch(0.97 0.005 250)"
  ledger-card: "oklch(0.22 0.01 250)"
  receipt-popover: "oklch(0.24 0.012 250)"
  action-blue: "oklch(0.72 0.14 245)"
  blue-ink: "oklch(0.17 0.008 250)"
  quiet-panel: "oklch(0.26 0.012 250)"
  muted-ink: "oklch(0.7 0.014 250)"
  alert-red: "oklch(0.64 0.21 25)"
  savings-green: "oklch(0.72 0.17 145)"
  caution-yellow: "oklch(0.78 0.16 78)"
  divider: "oklch(0.3 0.012 250)"
  input-field: "oklch(0.195 0.008 250)"
  chart-blue: "oklch(0.72 0.12 205)"
typography:
  display:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0"
  headline:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "0"
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "18px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "0"
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.43
    letterSpacing: "0"
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "0.06em"
  data:
    fontFamily: "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace"
    fontSize: "16px"
    fontWeight: 650
    lineHeight: 1.5
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
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.blue-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    backgroundColor: "transparent"
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
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.blue-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
---

# Design System: NoteWise

## Overview

NoteWise should feel like a compact ledger that lives on a phone: dark, legible, fast to scan, and built around the next useful action. The system is restrained because the product is task-heavy. Blue is reserved for action, selection, confirmation, and trustworthy data emphasis.

## Rules

- Keep the upload action visible and primary on the dashboard.
- Use action blue for primary action, active navigation, upload, and chart continuity.
- Use mono para valores em BRL e percentuais que o usuario precisa comparar.
- Pair semantic color with labels or icons for price increases, savings, and errors.
- Avoid glossy gradients, glassmorphism, gradient text, colored side-stripe borders, and oversized marketing blocks.
- Keep mobile cards compact, with clear spacing and predictable repeated row patterns.
