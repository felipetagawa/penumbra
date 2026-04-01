import * as THREE from 'three'

/**
 * lightSystem.js — Fontes de luz, detecção de sombra e interação (F-05)
 *
 * Cada luz tem:
 *   - estado: on | off
 *   - highlight quando o jogador está próximo (range de interação)
 *   - pode ser desligada/ligada com toggleNearest()
 *
 * Detecção de sombra:
 *   Raycasting do player → cada luz ativa.
 *   Obstáculo no caminho = sombra = seguro.
 */

const INTERACT_RANGE    = 6      // distância máxima para interagir com a luz
const HIGHLIGHT_RANGE   = 8      // distância para começar a mostrar highlight
const HACK_OFF_DURATION = 5      // segundos que a luz fica desligada após hack
const MAX_CHARGES       = 3      // cargas máximas de hack
const RECHARGE_INTERVAL = 8      // segundos para recarregar 1 carga (na sombra)

export function createLightSystem(scene) {
  const lights = []           // lista de objetos de luz gerenciados
  let hackCharges      = MAX_CHARGES
  let rechargeTimer    = 0
  let emergencyMode    = false

  // Luz ambiente muito fraca — mundo quase escuro
  const ambient = new THREE.AmbientLight(0x0a0a1a, 0.4)
  scene.add(ambient)

  // --- Definição das fontes de luz no nível ---
  // [x, y, z, color, intensity, range, interactable]
  const lightDefs = [
    [0,   3.5,  0,    0xffffff, 3.0, 8,  true],   // centro — luz principal
    [12,  3.5, -12,   0xffaa44, 2.5, 7,  true],   // canto NE
    [-12, 3.5,  12,   0x4488ff, 2.5, 7,  true],   // canto SW
    [0,   3.5,  18,   0xffcc88, 2.0, 6,  true],   // fundo
    [-18, 3.5, -5,    0xffffff, 2.0, 6,  true],   // lateral esquerda
  ]

  lightDefs.forEach(([x, y, z, color, intensity, range, interactable]) => {
    // PointLight Three.js
    const pointLight = new THREE.PointLight(color, intensity, range * 3)
    pointLight.position.set(x, y, z)
    pointLight.castShadow = true
    pointLight.shadow.mapSize.width = 512
    pointLight.shadow.mapSize.height = 512
    pointLight.shadow.camera.near = 0.1
    pointLight.shadow.camera.far = range * 3
    scene.add(pointLight)

    // Esfera visual — muda aparência conforme estado
    const geo = new THREE.SphereGeometry(0.2, 10, 10)
    const mat = new THREE.MeshBasicMaterial({ color })
    const sphere = new THREE.Mesh(geo, mat)
    sphere.position.set(x, y, z)
    scene.add(sphere)

    // Halo de highlight (anel ao redor da esfera, visível quando próximo)
    const haloGeo = new THREE.RingGeometry(0.32, 0.42, 24)
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0
    })
    const halo = new THREE.Mesh(haloGeo, haloMat)
    halo.position.set(x, y, z)
    halo.lookAt(x, y + 1, z) // sempre horizontal
    scene.add(halo)

    let spriteData = null
    if (interactable) {
      spriteData = createCooldownSprite()
      spriteData.sprite.position.set(x, y + 0.5, z)
      scene.add(spriteData.sprite)
    }

    lights.push({
      pointLight,
      sphere,
      halo,
      spriteData,
      position: new THREE.Vector3(x, y, z),
      color,
      intensity,
      range,
      interactable,
      on: true,
      hackTimer: 0,
    })
  })

  // Raycaster para detecção de sombra
  const raycaster = new THREE.Raycaster()
  const playerPos = new THREE.Vector3()

  // -----------------------------------------------------------------
  // checkPlayerLight — chamado todo frame
  // Retorna { inLight, exposureLevel, nearbyLight }
  // nearbyLight: objeto de luz mais próxima dentro de INTERACT_RANGE (ou null)
  // -----------------------------------------------------------------
  function checkPlayerLight(cameraPosition, obstacles) {
    playerPos.copy(cameraPosition)
    playerPos.y -= 0.5

    let maxExposure = 0
    let closestDist = Infinity
    let nearbyLight = null

    for (const entry of lights) {
      const dist = playerPos.distanceTo(entry.position)

      // Highlight: mostrar anel se dentro de HIGHLIGHT_RANGE e interactable e on
      if (entry.interactable) {
        const highlightOpacity = dist < HIGHLIGHT_RANGE
          ? Math.max(0, 1 - (dist / HIGHLIGHT_RANGE)) * 0.85
          : 0
        entry.halo.material.opacity = highlightOpacity
        // Cor do halo: amarelo-dourado quando interactável, cinza quando desligada
        entry.halo.material.color.set(entry.on ? 0xffdd88 : 0x888888)
      }

      // Luz mais próxima dentro do range de interação
      if (entry.interactable && dist < INTERACT_RANGE && dist < closestDist) {
        closestDist = dist
        nearbyLight = entry
      }

      // Pular detecção de luz se desligada
      if (!entry.on) continue
      if (dist > entry.range * 3) continue

      // Raycasting player → luz
      const dir = new THREE.Vector3().subVectors(entry.position, playerPos).normalize()
      raycaster.set(playerPos, dir)
      raycaster.far = dist

      const hits = raycaster.intersectObjects(obstacles, false)

      if (hits.length === 0) {
        const falloff = 1 - Math.min(dist / (entry.range * 3), 1)
        const exposure = falloff * entry.intensity * 0.25
        maxExposure = Math.max(maxExposure, exposure)
      }
    }

    return {
      inLight: maxExposure > 0.05,
      exposureLevel: Math.min(maxExposure, 1),
      nearbyLight,
    }
  }

  // -----------------------------------------------------------------
  // hackLight — desliga uma luz consumindo 1 carga de hack
  // Retorna false se sem cargas (recusa o hack)
  // -----------------------------------------------------------------
  function hackLight(entry) {
    if (!entry || !entry.interactable) return false

    // --- Recusa: sem cargas ---
    if (hackCharges === 0) {
      showHackMessage('SEM ENERGIA — aguarde', '#ff4444')
      return false
    }

    // A luz já está desligada: ligar normalmente (sem custo de carga)
    if (!entry.on) {
      _setLightOn(entry, true)
      entry.hackTimer = 0
      return true
    }

    // Desligar — consumir 1 carga
    hackCharges--
    _setLightOn(entry, false)
    entry.hackTimer = HACK_OFF_DURATION

    return true
  }

  // toggleLight mantido para compatibilidade (restart, etc.) — sem custo de carga
  function toggleLight(entry) {
    if (!entry || !entry.interactable) return
    _setLightOn(entry, !entry.on)
  }

  function _setLightOn(entry, state) {
    entry.on = state
    const targetIntensity = state ? (emergencyMode ? entry.intensity + 0.5 : entry.intensity) : 0
    entry.pointLight.intensity = targetIntensity
    
    if (state) {
      entry.sphere.material.color.set(entry.color)
    } else {
      entry.sphere.material.color.set(0x222233)
    }
  }

  // -----------------------------------------------------------------
  // setEmergencyMode — aumenta a intensidade global em +0.5
  // -----------------------------------------------------------------
  function setEmergencyMode(active) {
    if (emergencyMode === active) return
    emergencyMode = active

    lights.forEach(entry => {
      if (entry.on) {
        entry.pointLight.intensity = emergencyMode ? entry.intensity + 0.5 : entry.intensity
      }
    })
  }

  // -----------------------------------------------------------------
  // update — recarga automática de hack charges
  // Chamar todo frame com (delta, playerInLight)
  // -----------------------------------------------------------------
  function update(delta, playerInLight) {
    // Atualiza lógica individual das luzes (cooldown de hack)
    for (const entry of lights) {
      if (!entry.interactable) continue

      if (!entry.on) {
        entry.hackTimer -= delta
        if (entry.hackTimer <= 0) {
          _setLightOn(entry, true)
          entry.hackTimer = 0
          if (entry.spriteData) entry.spriteData.sprite.visible = false
        } else if (entry.spriteData) {
          entry.spriteData.sprite.visible = true
          const progress = Math.max(0, 1 - (entry.hackTimer / HACK_OFF_DURATION))
          const { ctx, texture } = entry.spriteData
          
          ctx.clearRect(0, 0, 64, 10)
          ctx.fillStyle = '#111'
          ctx.fillRect(0, 0, 64, 10)
          ctx.fillStyle = progress < 0.6 ? '#ff3300' : '#00ffcc'
          ctx.fillRect(1, 1, Math.floor(62 * progress), 8)
          ctx.strokeStyle = '#333'
          ctx.strokeRect(0, 0, 64, 10)
          texture.needsUpdate = true
        }
      } else {
        if (entry.spriteData && entry.spriteData.sprite.visible) {
          entry.spriteData.sprite.visible = false
        }
      }
    }

    // Recarga só acontece na sombra
    if (!playerInLight && hackCharges < MAX_CHARGES) {
      rechargeTimer += delta
      if (rechargeTimer >= RECHARGE_INTERVAL) {
        hackCharges = Math.min(hackCharges + 1, MAX_CHARGES)
        rechargeTimer = 0
      }
    } else if (playerInLight) {
      // Para o timer enquanto está na luz
      rechargeTimer = 0
    }

    updateChargesHUD()
  }

  // -----------------------------------------------------------------
  // HUD de cargas
  // -----------------------------------------------------------------
  function updateChargesHUD() {
    const el = document.getElementById('hack-charges')
    if (!el) return
    const filled = '◆'.repeat(hackCharges)
    const empty  = '◇'.repeat(MAX_CHARGES - hackCharges)
    el.textContent = `HACK ${filled}${empty}  [E]`
    el.style.opacity = hackCharges === 0 ? '0.45' : '1'
  }

  let _hackMsgTimer = null
  function showHackMessage(msg, color = '#00ffcc') {
    const el = document.getElementById('hack-charges')
    if (!el) return
    const prev = el.textContent
    const prevColor = el.style.color
    el.textContent = msg
    el.style.color = color
    clearTimeout(_hackMsgTimer)
    _hackMsgTimer = setTimeout(() => {
      el.style.color = prevColor || '#00ffcc'
      updateChargesHUD()
    }, 1400)
  }

  // -----------------------------------------------------------------
  // getLights — expõe a lista para raycasting de obstáculos
  // -----------------------------------------------------------------
  function getLights() {
    return lights
  }

  function getHackCharges() { return hackCharges }

  return { getLights, checkPlayerLight, toggleLight, hackLight, update, getHackCharges, setEmergencyMode }
}

function createCooldownSprite() {
  const canvas = document.createElement('canvas')
  canvas.width = 64; canvas.height = 10
  const ctx = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
  const sprite = new THREE.Sprite(spriteMat)
  sprite.scale.set(1.2, 0.18, 1)
  sprite.visible = false
  return { sprite, canvas, ctx, texture }
}
