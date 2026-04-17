# Story BLA-15: Refinar Upload de Imagens de NFC-e

**Status**: Ready

## Story

**Como** usuario do NoteWise,
**eu quero** enviar fotos de notas fiscais com o mesmo fluxo de upload ja usado para PDF,
**para** processar notas fisicas sem scanner e com feedback adequado para imagens.

## Contexto

O suporte basico a `image/jpeg`, `image/png` e `image/webp` ja existe no fluxo atual. Esta story cobre apenas os gaps restantes para tornar o upload de imagem confiavel, testado e explicitamente validado.

## Cenarios (Gherkin)

### Cenario 1: upload de imagem suportada
**Given** um arquivo `image/jpeg`, `image/png` ou `image/webp`
**When** o usuario selecionar o arquivo no upload
**Then** o componente deve aceitar o arquivo
**And** deve exibir nome do arquivo, estado de processamento e indicador visual de que o arquivo selecionado e uma imagem

### Cenario 2: MIME type ausente ou inconsistente
**Given** um arquivo de imagem cujo `file.type` venha vazio ou inconsistente
**When** o usuario selecionar um arquivo com extensao `.jpg`, `.jpeg`, `.png` ou `.webp`
**Then** o frontend deve aceitar o arquivo com base na extensao suportada
**And** a requisicao para `/api/extract-pdf` deve determinar um `mediaType` suportado com fallback seguro no backend
**And** deve rejeitar o arquivo com erro claro se nao houver como inferir um tipo suportado

### Cenario 3: processamento multimodal no Gemini
**Given** uma imagem valida enviada para a API
**When** o payload for encaminhado ao Gemini
**Then** o `mediaType` correto deve ser enviado
**And** o schema de saida deve permanecer compativel com o fluxo atual de PDF

### Cenario 4: persistencia no mesmo esquema de nota
**Given** uma imagem processada com sucesso
**When** a nota for salva no banco
**Then** ela deve usar o mesmo esquema de persistencia do fluxo de PDF
**And** o usuario deve conseguir consultar o resultado normalmente depois da importacao

## Requisitos Nao Funcionais

1. O fluxo de PDF atual nao pode regredir.
2. Tipos suportados nesta story: `image/jpeg`, `image/png` e `image/webp`.
3. A interface deve deixar claro quando o arquivo e uma imagem e quando o tipo nao e suportado.
4. O quality gate deve usar `npx tsc --noEmit`, alinhado ao repositorio.

## Spec Tecnica Curta

1. Frontend: aceitar imagens suportadas por MIME ou extensao (`.jpg`, `.jpeg`, `.png`, `.webp`) quando `file.type` vier vazio.
2. Backend: inferir `mediaType` por MIME recebido e, em fallback, pela extensao do arquivo.
3. Feedback visual esperado: nome do arquivo, indicador de imagem e estado de upload/processamento; esta story nao exige thumbnail.

## Dependencias

1. Fluxo atual de upload e extracao em `components/pdf-upload.tsx` e `app/api/extract-pdf/route.ts`.

## Riscos e Rollback

1. Risco de comportamento divergente entre PDF e imagem no mesmo endpoint.
2. Risco de MIME incorreto causar falha silenciosa no Gemini.
3. Rollback deve manter o suporte atual a PDF e, se necessario, voltar ao comportamento de imagem ja existente sem os refinamentos extras.

## Estrategia de Validacao

1. Testes de componente para aceitar imagens suportadas e rejeitar tipos invalidos.
2. Testes da rota para `mediaType` correto e fallback quando `file.type` vier ausente.
3. Validacao manual com ao menos um `JPEG` real.

## Estimativa

`S`

## executor-assignment

executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: ["npm run lint", "npx tsc --noEmit", "npm test"]

## Tasks / Subtasks

- [ ] Revisar e documentar o suporte atual a imagens no frontend e backend.
- [ ] Implementar fallback seguro para `mediaType` quando `file.type` vier vazio ou inconsistente.
- [ ] Ajustar feedback visual e mensagens de erro para imagens.
- [ ] Adicionar testes automatizados para upload de imagem e payload da API.
- [ ] Validar persistencia com imagem real.

## Dev Notes

- O modelo `gemini-2.5-flash` ja e multimodal e suporta imagens nativamente no SDK da Vercel AI.
- Esta story nao inclui `HEIC` e `HEIF`; se esse suporte for desejado depois, deve virar story separada.
- O objetivo e fechar os gaps reais do fluxo, nao reimplementar suporte que ja existe.

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-04-16 | 2.0 | Reescrita para refletir gaps reais do upload de imagem e quality gate correto | OpenCode |
| 2026-03-19 | 1.0 | Criacao inicial da story | Morgan (PM) |
