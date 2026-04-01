# PENUMBRA — Game Design Document (AI Optimized)

## 🎮 Visão Geral
Penumbra é um jogo 3D do gênero puzzle-stealth onde o jogador controla uma entidade que só pode existir na sombra.

A mecânica central do jogo é:
> LUZ = perigo  
> SOMBRA = sobrevivência  

O jogador deve navegar pelo ambiente manipulando luz para criar caminhos seguros.

---

## 🧠 Conceito Principal

O personagem (UMBRA-7):
- Existe apenas em áreas de sombra
- Sofre dano ao entrar na luz
- Pode se mover por qualquer superfície (chão, parede, teto) desde que esteja na sombra

---

## 🧩 Mecânicas Principais

### F-01 — Sistema de Sombra
- Detectar se o jogador está em área iluminada ou em sombra
- Se estiver na luz → perder integridade ao longo do tempo
- Se estiver na sombra → seguro

---

### F-02 — Movimento em Superfícies
- Movimento livre (WASD)
- Futuramente: permitir andar em paredes e teto

---

### F-03 — Integridade (Vida)
- Representa a “existência” do jogador
- Diminui na luz
- Zero = game over

---

### F-04 — Fontes de Luz
- Luzes no cenário definem áreas jogáveis
- Podem ser manipuladas (fases futuras)

---

### F-05 — Hacking de Luz (Futuro)
- Desligar luz
- Mover luz
- Criar caminhos de sombra

---

### F-06 — Inimigos (Futuro)
- Detectam o jogador usando luz (cone de visão)
- Estados:
  - Patrulha
  - Suspeito
  - Alerta

---

## 🎯 Objetivo do Protótipo

Criar uma versão jogável com:
- Player controlável
- Luz e sombra afetando gameplay
- Sistema de dano na luz
- Feedback visual simples

---

## ⚙️ Requisitos Técnicos

- Engine: Three.js
- Linguagem: JavaScript
- Execução: navegador (localhost)
- Arquitetura modular

---

## 🧱 Arquitetura Esperada

Separar em módulos:

- player.js → controle do jogador
- lightSystem.js → controle de luz/sombra
- scene.js → setup da cena
- gameLogic.js → regras (vida, morte, etc.)

---

## 🚧 Escopo (IMPORTANTE)

Foco no protótipo:
- Gameplay > gráficos
- Simples, funcional e testável
- Sem otimizações prematuras

---

## 🧠 Regras para IA

- Não quebrar funcionalidades existentes
- Sempre ler o projeto antes de alterar
- Implementar uma feature por vez
- Código limpo e organizado
- Evitar complexidade desnecessária

---

## 🏁 Critério de Sucesso

O protótipo é considerado válido se:

- O jogador consegue se mover
- Existe luz no cenário
- Estar na luz causa dano
- O jogo pode terminar (game over)
