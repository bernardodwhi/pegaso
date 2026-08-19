# Pégaso

Análise qualitativa da marcha equina — e o **Olimpo**, a vitrine/álbum virtual
compartilhável dos cavalos de elite do haras.

Este repositório contém a **landing de lançamento** (versão 2): um site estático,
sem framework de UI, em português do Brasil.

## Como visualizar

Precisa ser servido por HTTP (as bibliotecas vêm de CDN e o `file://` atrapalha
algumas APIs). Na raiz do projeto:

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

Qualquer servidor estático serve (`npx serve`, `php -S localhost:8000`, etc.).

## Estrutura

```
index.html        marcação das 11 seções
css/styles.css    tokens, tipografia e todo o layout
js/app.js         partículas, scrolltelling e interações
```

Sem build, sem dependências instaladas. As bibliotecas entram por CDN
(Three.js r128, GSAP 3.12 + ScrollTrigger, Lenis 1.1) e as fotos por hotlink
do Unsplash.

## Direção de arte — "meia-noite no haras"

Tokens declarados em `:root` e usados em todo o CSS:

| token | valor | uso |
| --- | --- | --- |
| `--bg` | `#0B0D10` | fundo |
| `--card` | `#141A22` | cartões |
| `--text` | `#F2EDE4` | texto |
| `--text-60` | `rgba(242,237,228,.62)` | texto secundário |
| `--gold` | `#C9A227` | acento |
| `--champagne` | `#E6C87A` | acento claro |
| `--bronze` | `#8C6A2F` | ponta escura dos degradês |
| `--line` | `rgba(242,237,228,.14)` | bordas e divisores |

Nenhuma cor fora desse sistema. Degradê `bronze → champanhe` só em barras de
progresso e medalhas. Tipografia: **Cormorant Garamond** (títulos e nomes de
animais) e **Inter** (UI e dados); a hierarquia sobe por peso, não por tamanho.

## Seções

0. Portão do haras (preloader `000 → 100`)
1. Herói — cavalo em marcha esculpido em partículas douradas
2. Cena da marcha — seção fixada com `pin + scrub`
3. Letreiro do plantel
4. Olimpo — ficha de campeão
5. Comparativo `( SEM PÉGASO )` × `( COM PÉGASO )`
6. Calculadora de valorização
7. Credenciais `( 01 )`–`( 04 )`
8. Depoimentos
9. FAQ
10. Encerramento + rodapé flutuante

## Comportamento e degradação

O cavalo do herói é gerado em tempo de execução: a silhueta é desenhada num
canvas fora da tela, os pixels são amostrados (com peso extra no contorno) e
viram ~15 mil pontos num `THREE.Points` com shader próprio.

- **Sem WebGL ou sem Three.js** → esfera de partículas em Canvas 2D.
- **Sem GSAP/Lenis** → a página inteira continua funcionando: a rolagem volta
  ao padrão do navegador, a seção da marcha completa o laudo ao entrar na tela
  e o letreiro fica estático.
- **`prefers-reduced-motion: reduce`** → tudo estático: as partículas desenham
  um único quadro, não há pin nem scrub, e os contadores já aparecem no valor
  final.
- **Abaixo de 1024px** o pin é desligado (o layout vira uma coluna e não caberia
  em uma tela), mas o mesmo scrub continua rodando ao longo da seção.
- `js/app.js` é carregado **antes** das bibliotecas, de propósito: `defer`
  executa na ordem do documento, então o preloader começa a contar sem esperar
  o download dos CDNs.

## Acessibilidade

Um único `h1`, `header/main/section/footer`, `alt` descritivo em todas as
imagens, foco visível em champanhe, e contraste AA verificado (o texto
secundário fica em ~6,6:1 sobre o fundo).
