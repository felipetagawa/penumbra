import * as THREE from 'three'
import { createScene, createRenderer, createCamera, buildLevel } from './scene.js'
import { createPlayer } from './player.js'
import { createLightSystem } from './lightSystem.js'
import { createGameLogic } from './gameLogic.js'
import { updateHUD, showGameOver, hideGameOver } from './ui.js'

/**
 * main.js — Entry point do jogo Penumbra
 * Orquestra todos os módulos e executa o loop de jogo
 */

// --- Setup ---
const scene = createScene()
const renderer = createRenderer()
const camera = createCamera()
const player = createPlayer(camera, scene)
const lightSystem = createLightSystem(scene)
const gameLogic = createGameLogic()

// Construir o nível
buildLevel(scene)

// Coletar todos os objetos sólidos da cena para raycasting
// (obstáculos que bloqueiam a luz)
let obstacles = []
scene.traverse((obj) => {
  if (obj.isMesh) obstacles.push(obj)
})

// --- Clock ---
const clock = new THREE.Clock()

// --- Game Over / Restart ---
gameLogic.onRestart(() => {
  gameLogic.restart()
  camera.position.set(-20, 1.7, -20)
  hideGameOver()
  // Religamos todas as luzes ao reiniciar
  lightSystem.getLights().forEach(entry => {
    if (!entry.on) lightSystem.toggleLight(entry)
  })
  clock.getDelta() // resetar delta para evitar spike
})

// --- Interação com luzes (tecla E) ---
let lastInteractedLight = null // evitar toggle duplo em uma única pressão

document.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyE') return
  if (gameLogic.getIsGameOver()) return

  // currentNearby é atualizado todo frame pela variável abaixo
  if (currentNearbyLight) {
    lightSystem.toggleLight(currentNearbyLight)
    showInteractFeedback(currentNearbyLight.on)
  }
})

// Referência para a luz mais próxima — atualizada no game loop
let currentNearbyLight = null

// --- Loop de jogo ---
function gameLoop() {
  requestAnimationFrame(gameLoop)

  const delta = Math.min(clock.getDelta(), 0.05)

  if (!gameLogic.getIsGameOver()) {
    // Atualizar player
    player.update(delta)

    // Verificar luz/sombra + obter luz próxima
    const { inLight, exposureLevel, nearbyLight } = lightSystem.checkPlayerLight(
      camera.position,
      obstacles
    )

    // Guardar referência para o listener de teclado
    currentNearbyLight = nearbyLight

    // Mostrar/esconder prompt de interação
    updateInteractPrompt(nearbyLight)

    // Atualizar lógica de jogo
    const died = gameLogic.update(delta, inLight, exposureLevel)

    // Atualizar HUD
    updateHUD(gameLogic.getIntegrityPercent(), inLight)

    // Efeito visual: tela pulsa vermelho se estiver na luz
    applyLightEffect(inLight, exposureLevel)

    if (died) {
      showGameOver()
    }
  }

  renderer.render(scene, camera)
}

// --- Overlay vermelho na luz ---
const lightOverlay = document.createElement('div')
lightOverlay.style.cssText = `
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(255,30,30,0.25) 100%);
  opacity: 0;
  transition: opacity 0.15s ease;
  z-index: 5;
`
document.body.appendChild(lightOverlay)

function applyLightEffect(inLight, exposureLevel) {
  lightOverlay.style.opacity = inLight ? (exposureLevel * 0.8).toFixed(2) : '0'
}

// --- Prompt de interação "[E] Desligar Luz" ---
const interactPrompt = document.createElement('div')
interactPrompt.style.cssText = `
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  color: #ffdd88;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  letter-spacing: 3px;
  text-transform: uppercase;
  padding: 8px 18px;
  border: 1px solid rgba(255, 221, 136, 0.35);
  background: rgba(0,0,0,0.6);
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
  z-index: 20;
  white-space: nowrap;
`
document.body.appendChild(interactPrompt)

function updateInteractPrompt(nearbyLight) {
  if (nearbyLight) {
    interactPrompt.textContent = nearbyLight.on ? '[E]  Desligar luz' : '[E]  Ligar luz'
    interactPrompt.style.opacity = '1'
    interactPrompt.style.color = nearbyLight.on ? '#ffdd88' : '#88bbff'
    interactPrompt.style.borderColor = nearbyLight.on
      ? 'rgba(255,221,136,0.35)'
      : 'rgba(136,187,255,0.35)'
  } else {
    interactPrompt.style.opacity = '0'
  }
}

// --- Feedback flash ao interagir ---
const interactFlash = document.createElement('div')
interactFlash.style.cssText = `
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.05s ease;
  z-index: 15;
`
document.body.appendChild(interactFlash)

function showInteractFeedback(lightIsNowOn) {
  // Flash branco ao ligar, flash azul escuro ao desligar
  interactFlash.style.background = lightIsNowOn
    ? 'rgba(255,255,200,0.12)'
    : 'rgba(0,0,50,0.2)'
  interactFlash.style.opacity = '1'
  setTimeout(() => { interactFlash.style.opacity = '0' }, 80)
}

gameLoop()
