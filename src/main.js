import * as THREE from 'three'
import { createScene, createRenderer, createCamera, buildLevel } from './scene.js'
import { createPlayer } from './player.js'
import { createLightSystem } from './lightSystem.js'
import { createGameLogic } from './gameLogic.js'
import { updateHUD, showGameOver, hideGameOver, setVictoryStats } from './ui.js'
import { createEnemySystem } from './enemySystem.js'
import { createLevelSystem } from './levelSystem.js'

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

// Sistema de inimigos — iniciado APÓS buildLevel e coleta de obstacles
const enemySystem = createEnemySystem(scene)

// Sistema de nível (portal de saída + condição de vitória)
const levelSystem = createLevelSystem(scene)

// Recalcular obstáculos e resetar inimigos ao mudar de fase
levelSystem.onPhaseChanged((newPhase) => {
  // O level system mudou ativamente de fase neste exato tick.
  gameLogic.completePhase()

  obstacles = []
  scene.traverse((obj) => {
    if (obj.isMesh && !obstacles.includes(obj)) obstacles.push(obj)
  })
  
  enemySystem.resetEnemyPatrols(newPhase)
  
  lightSystem.getLights().forEach(entry => {
    if (!entry.on) lightSystem.toggleLight(entry)
  })
})

// Garantir que os meshes dos drones também entrem na lista de obstacles inicial
scene.traverse((obj) => {
  if (obj.isMesh && !obstacles.includes(obj)) obstacles.push(obj)
})

// --- Clock ---
const clock = new THREE.Clock()

// --- Game Over / Restart ---
gameLogic.onRestart(() => {
  gameLogic.restart()
  gameLogic.resetTimer()
  gameLogic.resetScore()

  camera.position.set(-20, 1.7, -20)
  hideGameOver()
  hideVictory()
  levelSystem.reset()
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
    const didHack = lightSystem.hackLight(currentNearbyLight)
    if (didHack) showInteractFeedback(currentNearbyLight.on)
  }
})

// Referência para a luz mais próxima — atualizada no game loop
let currentNearbyLight = null
let isVictoryActive = false   // pausa o jogo quando player vence
let wasDetectedLastFrame = false

let globalAlertActive = false
let globalAlertTimer = 0
const globalAlertEl = document.getElementById('global-alert')
const alertOverlayEl = document.getElementById('alert-overlay')

// --- Loop de jogo ---
function gameLoop() {
  requestAnimationFrame(gameLoop)

  const delta = Math.min(clock.getDelta(), 0.05)

  if (!gameLogic.getIsGameOver() && !isVictoryActive) {
    // Atualizar player
    player.update(delta)

    // Verificar luz/sombra + obter luz próxima
    const { inLight, exposureLevel, nearbyLight } = lightSystem.checkPlayerLight(
      camera.position,
      obstacles
    )

    // Atualizar recarga de hack charges (só recarrega na sombra)
    lightSystem.update(delta, inLight)

    // Atualizar inimigos — retorna se o player foi detectado por um drone
    const { detectedByEnemy, detectionExposure } = enemySystem.update(
      delta,
      camera.position,
      obstacles
    )

    // Combinar exposição: luz estática + detecção por inimigo
    const totalInLight     = inLight || detectedByEnemy
    const totalExposure    = Math.min(1, exposureLevel + (detectedByEnemy ? detectionExposure * 1.5 : 0))

    if (detectedByEnemy && !wasDetectedLastFrame) {
      gameLogic.addDetectionPenalty()
    }
    wasDetectedLastFrame = detectedByEnemy

    // ---- Alerta Global ----
    const anyAlert = enemySystem.getAlertState()
    if (anyAlert) {
      if (!globalAlertActive) {
        globalAlertActive = true
        lightSystem.setEmergencyMode(true)
        if (globalAlertEl) globalAlertEl.style.display = 'block'
      }
      globalAlertTimer = 5.0
    } else if (globalAlertTimer > 0) {
      globalAlertTimer -= delta
      if (globalAlertTimer <= 0) {
        globalAlertActive = false
        lightSystem.setEmergencyMode(false)
        if (globalAlertEl) globalAlertEl.style.display = 'none'
        if (alertOverlayEl) alertOverlayEl.style.opacity = '0'
      }
    }

    if (globalAlertActive) {
      if (alertOverlayEl) {
        alertOverlayEl.style.opacity = (0.04 + Math.sin(Date.now() * 0.008) * 0.04).toFixed(4)
      }
      if (globalAlertEl) {
        // pisca o texto do alerta usando opacidade
        globalAlertEl.style.opacity = (0.5 + Math.sin(Date.now() * 0.015) * 0.5).toString()
      }
    }

    // Atualizar sistema de nível — verifica se player chegou à saída
    const justWon = levelSystem.update(delta, camera.position)
    if (justWon) {
      gameLogic.completePhase() // pontuar a fase final
      showVictory()
    }

    // Guardar referência para o listener de teclado
    currentNearbyLight = nearbyLight

    // Mostrar/esconder prompt de interação
    updateInteractPrompt(nearbyLight)

    // Atualizar lógica de jogo (usa exposição combinada)
    const died = gameLogic.update(delta, totalInLight, totalExposure)

    // Atualizar HUD
    updateHUD(gameLogic.getIntegrityPercent(), totalInLight, gameLogic.getScore(), gameLogic.getTimer())

    // Efeito visual: tela pulsa vermelho se estiver na luz estática + CSS glitch
    applyLightEffect(inLight, exposureLevel, gameLogic.getIntegrityPercent())

    // Efeito visual: overlay verde-scan se detectado por inimigo
    applyEnemyDetectionEffect(detectedByEnemy, detectionExposure)

    if (died) {
      showGameOver()
    }
  }

  // Atualizar seta direcional do objetivo
  updateObjectiveArrow(camera.position, camera.rotation.y, levelSystem.getExitPosition())

  // Atualizar minimap
  updateMinimap(camera, enemySystem.getEnemyPositions(), levelSystem.getExitPosition())

  renderer.render(scene, camera)
}

// --- HUD de Bússola Objetivo ---
function updateObjectiveArrow(playerPos, playerYaw, exitPos) {
  const dx = exitPos.x - playerPos.x
  const dz = exitPos.z - playerPos.z
  
  // 1. Calcula o ângulo horizontal (inverte-se o dz pois o -Z é a frente no ThreeJS)
  const angle = Math.atan2(dx, -dz)
  
  // 2. Subtrai o yaw atual da câmera para obter o ângulo relativo
  const relativeAngle = angle - (-playerYaw)
  const angleDeg = relativeAngle * (180 / Math.PI)

  const arrowEl = document.getElementById('objective-arrow')
  if (arrowEl) {
    arrowEl.style.transform = `rotate(${angleDeg}deg)`
  }
  
  const distEl = document.getElementById('portal-dist')
  if (distEl) {
    const dist = Math.round(Math.hypot(dx, dz))
    distEl.textContent = `PORTAL — ${dist}m`
  }
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

function applyLightEffect(inLight, exposureLevel, integrity) {
  lightOverlay.style.opacity = inLight ? (exposureLevel * 0.8).toFixed(2) : '0'

  // Remover classes de glitch
  document.body.classList.remove('glitch-light', 'glitch-heavy')

  if (inLight) {
    // Quando entra na luz, ou se a vida está baixa e está na luz, o glitch intensifica
    if (integrity < 40 || exposureLevel > 0.8) {
      // Glitch pesado: sepia forte, aberração, tremor maior
      document.body.classList.add('glitch-heavy')
    } else {
      // Glitch leve: apenas um shift de cor suave
      document.body.classList.add('glitch-light')
    }
  }
}

// --- Overlay verde ao ser detectado por inimigo ---
const enemyOverlay = document.createElement('div')
enemyOverlay.style.cssText = `
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 30%, rgba(0,255,80,0.18) 100%);
  opacity: 0;
  transition: opacity 0.1s ease;
  z-index: 6;
`
document.body.appendChild(enemyOverlay)

// Label de alerta do inimigo
const enemyAlertLabel = document.createElement('div')
enemyAlertLabel.textContent = '⚠  DRONE DETECTOU VOCÊ'
enemyAlertLabel.style.cssText = `
  position: fixed;
  top: 18%;
  left: 50%;
  transform: translateX(-50%);
  color: #00ff55;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  letter-spacing: 4px;
  text-transform: uppercase;
  padding: 6px 16px;
  border: 1px solid rgba(0,255,80,0.4);
  background: rgba(0,0,0,0.7);
  border-radius: 3px;
  opacity: 0;
  transition: opacity 0.1s ease;
  pointer-events: none;
  z-index: 25;
  white-space: nowrap;
`
document.body.appendChild(enemyAlertLabel)

function applyEnemyDetectionEffect(detected, exposure) {
  if (detected) {
    enemyOverlay.style.opacity = (0.4 + exposure * 0.6).toFixed(2)
    enemyAlertLabel.style.opacity = '1'
  } else {
    enemyOverlay.style.opacity = '0'
    enemyAlertLabel.style.opacity = '0'
  }
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
  transition: opacity 0.2s ease-out, filter 0.2s ease-out;
  z-index: 15;
  background: rgba(255,255,255,0.1);
  filter: hue-rotate(90deg) contrast(1.5);
`
document.body.appendChild(interactFlash)

function showInteractFeedback(lightIsNowOn) {
  // Flash de 'scan' rápido (efeito hacker)
  interactFlash.style.background = lightIsNowOn
    ? 'rgba(0,255,200,0.15)'
    : 'rgba(200,0,255,0.15)'
  interactFlash.style.opacity = '1'
  interactFlash.style.filter = 'hue-rotate(0deg) invert(10%) contrast(1.2)'
  
  setTimeout(() => { 
    interactFlash.style.opacity = '0' 
    interactFlash.style.filter = 'hue-rotate(90deg) contrast(1.5)'
  }, 50)
}

// --- Tela de vitória ---
const victoryScreen = document.getElementById('victory')

function showVictory() {
  isVictoryActive = true
  setVictoryStats(gameLogic.getScore(), gameLogic.getTimer())
  victoryScreen.classList.add('visible')
  document.exitPointerLock()
}

function hideVictory() {
  victoryScreen.classList.remove('visible')
}

// Botão "Jogar Novamente" na tela de vitória — reusa o mesmo restart do gameLogic
document.getElementById('victory-restart-btn').addEventListener('click', () => {
  hideVictory()
  isVictoryActive = false
  gameLogic.restart()
  gameLogic.resetTimer()
  gameLogic.resetScore()

  camera.position.set(-20, 1.7, -20)
  levelSystem.reset()
  lightSystem.getLights().forEach(entry => {
    if (!entry.on) lightSystem.toggleLight(entry)
  })

  // Reset do alerta global
  globalAlertActive = false
  globalAlertTimer = 0
  lightSystem.setEmergencyMode(false)
  if (globalAlertEl) globalAlertEl.style.display = 'none'
  if (alertOverlayEl) alertOverlayEl.style.opacity = '0'

  clock.getDelta()
})

// --- Minimap ---
function updateMinimap(camera, enemiesList, exitPos) {
  const mm = document.getElementById('minimap')
  if (!mm) return
  const mc = mm.getContext('2d')
  mc.clearRect(0, 0, 140, 140)

  // b) Escala
  const scale = 140 / 60   // ~2.33px por unidade

  // c) Desenhar borda do mapa
  mc.strokeStyle = 'rgba(0,255,204,0.2)'
  mc.lineWidth = 1
  mc.strokeRect(1, 1, 138, 138)

  // d) Pilares
  mc.fillStyle = 'rgba(80,0,180,0.5)'
  const pilares = [
    [-8,-8], [8,-8], [-8,8], [8,8],
    [0,-15], [0,15], [-15,0], [15,0]
  ]
  pilares.forEach(([px, pz]) => {
    const cx = (px + 30) * scale
    const cy = (pz + 30) * scale
    mc.fillRect(cx - 1.7, cy - 1.7, 3.5, 3.5)
  })

  // e) Portal de saída
  const exitCx = (exitPos.x + 30) * scale
  const exitCy = (exitPos.z + 30) * scale
  mc.beginPath()
  mc.arc(exitCx, exitCy, 5, 0, Math.PI * 2)
  mc.fillStyle = 'rgba(0,255,180,0.8)'
  mc.fill()

  // f) Drones
  enemiesList.forEach(e => {
    const droneCx = (e.x + 30) * scale
    const droneCy = (e.z + 30) * scale
    const droneColor = e.state === 'alert' ? '#ff2200' : '#ff8800'
    mc.beginPath()
    mc.arc(droneCx, droneCy, 4, 0, Math.PI * 2)
    mc.fillStyle = droneColor
    mc.fill()
  })

  // g) Player
  const playerCx = (camera.position.x + 30) * scale
  const playerCy = (camera.position.z + 30) * scale
  mc.beginPath()
  mc.arc(playerCx, playerCy, 4, 0, Math.PI * 2)
  mc.fillStyle = '#00e5ff'
  mc.fill()
  
  // Seta do Player
  const yaw = camera.rotation.y
  mc.beginPath()
  mc.moveTo(playerCx, playerCy)
  mc.lineTo(playerCx - Math.sin(yaw) * 9, playerCy - Math.cos(yaw) * 9)
  mc.strokeStyle = '#00e5ff'
  mc.lineWidth = 1.5
  mc.stroke()
}

gameLoop()
