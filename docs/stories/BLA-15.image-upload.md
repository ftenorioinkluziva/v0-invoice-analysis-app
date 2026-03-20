# Story BLA-15: Suporte a Upload de Imagens (NFC-e)

**Status**: Draft

## Story

**As a** usuário do NoteWise,
**I want** realizar o upload de fotos de notas fiscais (JPG/PNG),
**so that** eu possa processar notas físicas que não possuo em PDF sem precisar de scanners externos.

## Acceptance Criteria

1. [ ] O componente `PdfUpload.tsx` deve permitir a seleção de arquivos de imagem (`image/jpeg`, `image/png`, `image/webp`).
2. [ ] A interface deve exibir ícones apropriados para imagens durante o preview.
3. [ ] A API `/api/extract-pdf` deve detectar o tipo de arquivo e configurar o `mediaType` correto para o Gemini.
4. [ ] O prompt do Gemini deve ser ajustado (se necessário) para garantir precisão em leitura de fotos (OCR).
5. [ ] O sistema deve salvar a nota no banco de dados com o mesmo esquema de dados do PDF.

## executor-assignment

executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: ["npm run lint", "npm run typecheck", "npm test"]

## Tasks / Subtasks

- [ ] **Frontend (UI/UX)**
  - [ ] Alterar `accept` no input de arquivo para incluir imagens.
  - [ ] Adicionar validação de tipo no `handleFileSelect`.
  - [ ] Ajustar ícones de feedback visual.
- [ ] **Backend (API/AI)**
  - [ ] Implementar detecção dinâmica de MIME type no roteamento.
  - [ ] Validar payload enviado ao Gemini.
- [ ] **Verificação**
  - [ ] Testar com imagem de exemplo (JPEG).
  - [ ] Validar persistência no NeonDB.

## Dev Notes

- O modelo `gemini-2.5-flash` já é multimodal e suporta imagens nativamente no SDK da Vercel AI.
- Mimetypes suportados: `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-19 | 1.0 | Criação inicial da story | Morgan (PM) |
