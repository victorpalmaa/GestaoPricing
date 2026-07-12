# Debug Session: localhost-not-updating [OPEN]

## Sintoma
- As alterações recentes não aparecem em `http://localhost:3000`.

## Escopo
- Frontend local servido em `localhost:3000`.

## Hipóteses
1. O processo na porta `3000` está servindo um artefato antigo.
2. O `build` novo foi gerado, mas o servidor local continuou apontando para uma pasta/arquivo anterior.
3. O navegador está usando cache agressivo dos assets JS/CSS e ignorando o bundle atualizado.
4. Existe mais de um processo/servidor local e o link aberto não corresponde ao processo que eu atualizei.
5. As mudanças estão no código-fonte, mas não entraram no bundle final por falha de build ou diferença de branch/worktree.

## Evidências Coletadas
- Pendente.

## Próximos Passos
- Confirmar processo ouvindo na porta `3000`.
- Confirmar hash do bundle servido vs. bundle em `build/`.
- Verificar possibilidade de cache do navegador.
