# NoteWise — Interface Design System

## Direction & Feel

**Domain:** Nota fiscal brasileira, lista de mercado em caderninho físico, etiqueta de prateleira, corredor de supermercado, cupom fiscal impresso.

**Who is this human:** Pessoa brasileira no supermercado, celular na mão, comparando preços e riscando itens de uma lista. Quer velocidade de leitura, toque fácil, feedback imediato.

**Feel:** Denso mas organizado. Funcional como um caderninho de anotações — sem decoração gratuita. Cada elemento tem um motivo de existir.

---

## Tokens

**Theme:** Dark-only. Sem modo claro.

```
--background:    oklch(0.07 0 0)   /* fundo da página */
--card:          oklch(0.13 0 0)   /* superfície de card */
--secondary:     oklch(0.18 0 0)   /* superfície elevada */
--border:        oklch(0.28 0 0)   /* separação padrão */
--primary:       oklch(0.78 0.16 165) /* verde — ação, destaque positivo */
--destructive:   oklch(0.65 0.2 25)  /* vermelho — alerta, remoção */
--success:       oklch(0.7 0.17 145) /* verde escuro — variação positiva */
--muted-foreground: oklch(0.68 0 0)  /* texto secundário */
```

**Font:** Geist (sans) + Geist Mono (números, preços, badges de dados).

---

## Depth Strategy

**Borders-only.** Sem shadows dramáticos. Cards com borda sutil (`border-border`).

Elevação via shift de background:
- Página: `bg-background`
- Card: `bg-card`
- Elevado (dropdown, popover): `bg-secondary` ou `bg-popover`
- Input: `bg-secondary/50` (levemente inset)

Dropdowns ficam `z-50` com `border border-border` e `bg-card`, sem backdrop-blur.

---

## Spacing

Base unit: `4px` (rem 0.25). Escala: `0.5 / 1 / 1.5 / 2 / 3 / 4 / 6 / 8`.

- Padding interno de card: `p-3` ou `p-4`
- Gap entre itens de lista: `space-y-2`
- Gap entre seções: `space-y-4` ou `gap-4`

---

## Signature Elements

### Borda esquerda por estado (item de lista)
Cards de item de lista têm `border-l-2` colorida por estado:
- Pendente: `border-l-primary/40` (verde sutil)
- Riscado: `border-l-border opacity-50` (cinza, recuado)

```tsx
className={cn(
  'bg-card transition-all duration-200',
  item.checked
    ? 'border-l-2 border-l-border opacity-50'
    : 'border-l-2 border-l-primary/40'
)}
```

### Categoria como corredor
Label de categoria com linha separadora horizontal — não card wrapper:
```tsx
<div className="mb-2 flex items-center gap-2">
  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
    {category}
  </span>
  <div className="h-px flex-1 bg-border/50" />
</div>
```

### Badge de variação de preço inline
Sem popover — badge tintado com ícone:
```tsx
<span className={cn(
  'inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] font-semibold',
  variation > 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
)}>
  <TrendingUp className="h-3 w-3" />
  {Math.abs(variation).toFixed(0)}%
</span>
```

### Lixeira quase invisível
Botão de remoção minimalista — quase invisível em repouso, destrutivo no hover:
```tsx
<button
  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:text-destructive"
  aria-label="Remover item"
>
  <Trash2 className="h-3.5 w-3.5" />
</button>
```

---

## Component Patterns

### Card de item de lista
- Checkbox: `h-7 w-7 rounded-md` (toque fácil mobile)
- Nome: `text-sm font-semibold capitalize` + `line-through` quando checked
- Preço total: `font-mono text-base font-bold` (destaque máximo)
- Transição: `transition-all duration-200` em nome, preço e card

### Footer fixo mobile
```tsx
<div className="fixed bottom-0 left-1/2 w-full max-w-lg -translate-x-1/2 px-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] pt-2">
  <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-md">
    ...
  </div>
</div>
```
Container da página com footer: `pb-32` mínimo.

### Dropdown de busca inline
Não usa ScrollArea. Div nativo com `overflow-y-auto overscroll-contain`:
```tsx
<div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
  <div className="max-h-48 overflow-y-auto overscroll-contain p-1">
    ...
  </div>
</div>
```

### Pills de sugestão
```tsx
<button className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/20 px-2.5 py-1 text-sm transition-colors hover:border-primary/30 hover:bg-secondary">
  <Plus className="h-3 w-3 shrink-0 text-primary" />
  <span className="max-w-36 truncate capitalize">{name}</span>
  <span className="shrink-0 rounded bg-secondary px-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
    {days}d
  </span>
</button>
```

---

## Avoid

- Backdrop blur em dropdowns e footers — usa `bg-card` sólido
- `ScrollArea` de shadcn para listas longas — prefere `overflow-y-auto` nativo
- Popovers para informação simples — prefere badges inline
- `new Pool()` por request — usa `getPool()` singleton
- Arbitrary values Tailwind quando existe classe canônica equivalente (ex: `h-[200px]` → `h-50`)
