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

## O Pégaso

O animal não é um asset: ele é construído em tempo de execução e é **um só
objeto**, num palco fixo (`#stage`) que atravessa a página inteira.

### Anatomia

A silhueta segue proporções de cavalo de sela em formato "quadrado", com a
altura da cernelha `H = 492` e o solo em `y = 850`:

| medida | proporção |
| --- | --- |
| corpo (ponta da espádua → nádega) | 1,020 H |
| solo → cotovelo | ≈ H/2 |
| profundidade da cilha | ≈ H/2, o ponto mais fundo do ventre |
| cabeça | ≈ 0,43 H |
| pescoço (nuca → cernelha) | ≈ 1,65 cabeças, a **51°** da horizontal |

O **porte** é o que distingue este animal de um cavalo de trabalho. A linha
nuca→cernelha sobe a 51° (medido; era 17°, quase deitada), a crista é
fortemente convexa, a cabeça é portada quase na vertical com o focinho acima
da linha da cernelha, e a nuca é o ponto mais alto da silhueta em repouso. A
cauda tem inserção alta e flui para cima e para trás, em lobos de chama.

O traço decisivo é o **perfil dorsal em S**: cernelha em pico acima da linha do
dorso, dorso curto e côncavo, garupa subindo de novo. É o que separa o cavalo do
asinino, cujo dorso é plano (Maśko et al., *Animals* 2022; Burnham, *AAEP Proc.*
48/2002). Somam-se pescoço longo e arqueado de inserção alta, cabeça refinada de
chanfro reto, membros longos com joelho, jarrete e boleto marcados, orelhas
curtas e cauda cheia de inserção alta.

### Movimento

Os membros têm rig próprio: cada partícula guarda em que membro, segmento e
posição interna vive, e a pose é recalculada a cada quadro por cinemática
direta. A cabeça também é articulada: cada partícula do tronco carrega um peso
de nuca, 1 na cabeça e nas orelhas, 0 no pescoço, com uma faixa de transição de
~110px na fauce — na levade só a cabeça gira, em torno da nuca, para a face
ficar próxima da vertical em vez de acompanhar rigidamente o giro do tronco. A quartela é resolvida por IK contra a linha do solo, para o casco
assentar plano em vez de flutuar nos extremos do apoio.

O ciclo é de **marcha** — quatro tempos, sem suspensão, apoio ocupando 62% do
ciclo de cada membro, o que produz os momentos de tríplice apoio que o laudo
mede. Os quatro cascos batem em `t = 0 · 0,35 · 0,50 · 0,85`, e é nesse ritmo
que a poeira dourada se desprende e as partículas pulsam.

Crina e cauda ondulam por uma onda que corre da raiz à ponta, com amplitude
sorteada por partícula — mechas soltas desenhadas no contorno sempre leem como
espinhos, então o vento vive na animação, não na silhueta.

### Coreografia

A cena vigente é a **última cuja seção cruzou uma linha da viewport** — regra
monótona na rolagem, imune à ordem em que gatilhos disparam durante um salto.

| seção | Pégaso |
| --- | --- |
| herói | marcha, à direita |
| a marcha | grande e apagado atrás de tudo, pulsando no ritmo dos cascos |
| Olimpo | as asas se abrem pena a pena — coberteiras, secundárias e primárias em camadas — quando a ficha entra |
| comparativo → FAQ | recuado e discreto, sem competir com os dados |
| encerramento | levade colecionada (peso nos posteriores, anteriores recolhidos, nuca flexionada, asas plenas), bate a asa, vira raio e se recompõe na constelação de Pégaso |

O encerramento é uma cena longa com o miolo *sticky*: dá espaço de rolagem sem
um segundo pin de ScrollTrigger, que desincronizava com o pin da marcha.

## Comportamento e degradação

- **Sem WebGL ou sem Three.js** → a mesma silhueta corrigida, estática, em
  pontos dourados no Canvas 2D.
- **Sem GSAP/Lenis** → a página inteira continua funcionando: a rolagem volta
  ao padrão do navegador, a seção da marcha completa o laudo ao entrar na tela
  e o letreiro fica estático.
- **`prefers-reduced-motion: reduce`** → tudo estático: nenhum WebGL, um
  emblema heráldico de Pégaso alado em traço fino dourado no lugar da nuvem,
  sem pin nem scrub, e os contadores já no valor final.
- **Guarda de quadro**: o buffer do palco pode render abaixo do tamanho em CSS
  (o CSS reamplia). Se a placa não sustenta 60fps ele encolhe até 60%; em GPU
  capaz volta sozinho à resolução cheia. O custo dominante é preenchimento, não
  contagem de partículas — medido em SwiftShader, 25fps a 100% contra 31fps a
  70% de buffer com a mesma nuvem.
- **Abaixo de 1024px** o pin é desligado (o layout vira uma coluna e não caberia
  em uma tela), mas o mesmo scrub continua rodando ao longo da seção.
- `js/app.js` é carregado **antes** das bibliotecas, de propósito: `defer`
  executa na ordem do documento, então o preloader começa a contar sem esperar
  o download dos CDNs.

## Acessibilidade

Um único `h1`, `header/main/section/footer`, `alt` descritivo em todas as
imagens, foco visível em champanhe, e contraste AA verificado (o texto
secundário fica em ~6,6:1 sobre o fundo).
