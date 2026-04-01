import * as THREE from 'three'

/**
 * levelSystem.js — Objetivo do nível, portal de saída e condição de vitória (Fase 5)
 * Fase 6/Refatorada: Suporte a múltiplas fases (progressão local).
 */

const EXIT_POSITION   = new THREE.Vector3(-20, 0, 22)
const EXIT_POSITION_2 = new THREE.Vector3(18, 0, -20)
const EXIT_RADIUS     = 2.8
const PORTAL_COLOR    = 0x00ffcc
const PORTAL_GLOW     = 0x00ffaa
const PORTAL_HOT      = 0x80ffee

export function createLevelSystem(scene) {
  let onPhaseChangedCallback = null
  let won = false
  let pulseTime = 0
  let currentLevel = 1
  
  let currentExitPosition = EXIT_POSITION.clone()

  // Referências para Update e Remoção
  let base, outerRing, midRing, innerRing, pillar, exitLight, exitLightTop
  let particles = []
  let stakes = []
  let phaseMeshes = [] // Armazenar meshes dinâmicos das fases 2 e 3

  function onPhaseChanged(cb) {
    onPhaseChangedCallback = cb
  }

  function buildPortal(position) {
    currentExitPosition.copy(position)

    // Limpa o portal antigo se existir
    if (base) {
      scene.remove(base)
      scene.remove(outerRing)
      scene.remove(midRing)
      scene.remove(innerRing)
      scene.remove(pillar)
      scene.remove(exitLight)
      scene.remove(exitLightTop)
    }
    
    particles.forEach(p => scene.remove(p))
    stakes.forEach(s => scene.remove(s))
    
    particles = []
    stakes = []

    // --- Base (disco semi-transparente) ---
    const baseGeo = new THREE.CylinderGeometry(EXIT_RADIUS, EXIT_RADIUS, 0.04, 48)
    const baseMat = new THREE.MeshBasicMaterial({ color: PORTAL_COLOR, transparent: true, opacity: 0.15 })
    base = new THREE.Mesh(baseGeo, baseMat)
    base.position.copy(position)
    base.position.y = 0.02
    scene.add(base)

    // --- Anel externo (grande, fixo) ---
    const outerRingGeo = new THREE.TorusGeometry(EXIT_RADIUS, 0.10, 16, 64)
    const outerRingMat = new THREE.MeshBasicMaterial({ color: PORTAL_COLOR })
    outerRing = new THREE.Mesh(outerRingGeo, outerRingMat)
    outerRing.position.copy(position)
    outerRing.position.y = 0.10
    outerRing.rotation.x = Math.PI / 2
    scene.add(outerRing)

    // --- Anel médio (gira sentido horário) ---
    const midRingGeo = new THREE.TorusGeometry(EXIT_RADIUS * 0.72, 0.065, 12, 48)
    const midRingMat = new THREE.MeshBasicMaterial({ color: PORTAL_GLOW })
    midRing = new THREE.Mesh(midRingGeo, midRingMat)
    midRing.position.copy(position)
    midRing.position.y = 0.10
    midRing.rotation.x = Math.PI / 2
    scene.add(midRing)

    // --- Anel interno (gira anti-horário, rápido) ---
    const innerRingGeo = new THREE.TorusGeometry(EXIT_RADIUS * 0.44, 0.05, 10, 36)
    const innerRingMat = new THREE.MeshBasicMaterial({ color: PORTAL_HOT })
    innerRing = new THREE.Mesh(innerRingGeo, innerRingMat)
    innerRing.position.copy(position)
    innerRing.position.y = 0.10
    innerRing.rotation.x = Math.PI / 2
    scene.add(innerRing)

    // --- Pilha de luz (cone subindo) ---
    const pillarGeo = new THREE.CylinderGeometry(0.06, EXIT_RADIUS * 0.25, 6, 16, 1, true)
    const pillarMat = new THREE.MeshBasicMaterial({
      color: PORTAL_GLOW,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
    })
    pillar = new THREE.Mesh(pillarGeo, pillarMat)
    pillar.position.copy(position)
    pillar.position.y = 3.0
    scene.add(pillar)

    // --- Partículas girantes ---
    const PARTICLE_COUNT = 24
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const pGeo = new THREE.SphereGeometry(0.06, 6, 6)
      const pMat = new THREE.MeshBasicMaterial({ color: PORTAL_GLOW, transparent: true, opacity: 0.9 })
      const p = new THREE.Mesh(pGeo, pMat)
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2
      const radius = EXIT_RADIUS * (0.6 + Math.random() * 0.5)
      const height = Math.random() * 2.5
      p.userData = { baseAngle: angle, radius, height, speed: 0.4 + Math.random() * 0.6 }
      p.position.set(
        position.x + Math.cos(angle) * radius,
        height,
        position.z + Math.sin(angle) * radius
      )
      scene.add(p)
      particles.push(p)
    }

    // --- Luz pontual do portal ---
    exitLight = new THREE.PointLight(PORTAL_COLOR, 4.0, 14)
    exitLight.position.copy(position)
    exitLight.position.y = 1.5
    scene.add(exitLight)

    exitLightTop = new THREE.PointLight(PORTAL_HOT, 1.5, 8)
    exitLightTop.position.copy(position)
    exitLightTop.position.y = 4.5
    scene.add(exitLightTop)

    // --- Estaques nos cantos ---
    const stakeMat = new THREE.MeshBasicMaterial({ color: PORTAL_COLOR })
    const stakeGeo = new THREE.BoxGeometry(0.12, 0.7, 0.12)
    const stakeOffsets = [
      [ EXIT_RADIUS * 0.7,  0,  EXIT_RADIUS * 0.7],
      [-EXIT_RADIUS * 0.7,  0,  EXIT_RADIUS * 0.7],
      [ EXIT_RADIUS * 0.7,  0, -EXIT_RADIUS * 0.7],
      [-EXIT_RADIUS * 0.7,  0, -EXIT_RADIUS * 0.7],
    ]
    stakeOffsets.forEach(([dx, , dz]) => {
      const stake = new THREE.Mesh(stakeGeo, stakeMat)
      stake.position.set(position.x + dx, 0.35, position.z + dz)
      scene.add(stake)
      stakes.push(stake)
    })
  }

  // Constrói o portal inicial
  buildPortal(EXIT_POSITION)

  // -----------------------------------------------------------------
  function update(delta, playerPosition) {
    if (won) return false

    pulseTime += delta

    // Pulsos principal e rápido
    const pulse    = (Math.sin(pulseTime * 2.8) + 1) * 0.5
    const fastPulse = (Math.sin(pulseTime * 6.5) + 1) * 0.5
    const slowPulse = (Math.sin(pulseTime * 1.2) + 1) * 0.5

    // Animações dos componentes
    outerRing.scale.setScalar(1 + pulse * 0.07)
    midRing.rotation.z += delta * 0.9
    innerRing.rotation.z -= delta * 1.8
    base.material.opacity = 0.08 + slowPulse * 0.20
    pillar.material.opacity = 0.05 + fastPulse * 0.12
    pillar.scale.y = 0.92 + pulse * 0.16
    exitLight.intensity   = 3.0 + pulse * 3.5
    exitLightTop.intensity = 0.8 + slowPulse * 1.5

    // Partículas
    for (const p of particles) {
      p.userData.baseAngle += delta * p.userData.speed * (pulseTime % 2 < 1 ? 1 : -1)
      const a = p.userData.baseAngle
      const r = p.userData.radius + Math.sin(pulseTime * 2 + a) * 0.3
      p.position.set(
        currentExitPosition.x + Math.cos(a) * r,
        p.userData.height + Math.sin(pulseTime * 1.5 + a * 3) * 0.4,
        currentExitPosition.z + Math.sin(a) * r
      )
      p.material.opacity = 0.4 + fastPulse * 0.6
    }

    // --- Verificar chegada do player ---
    const playerFlat = playerPosition.clone()
    playerFlat.y = 0
    const exitFlat = currentExitPosition.clone()
    exitFlat.y = 0

    if (playerFlat.distanceTo(exitFlat) < EXIT_RADIUS) {
      if (currentLevel === 1) {
        currentLevel = 2
        buildPortal(new THREE.Vector3(0, 0, -25))
        buildPhaseLayout(scene, 2)
        
        const objText = document.getElementById('objective-text')
        if (objText) objText.textContent = "▶ NOVO OBJETIVO DETECTADO"
        
        const phaseDisp = document.getElementById('phase-display')
        if (phaseDisp) phaseDisp.textContent = "FASE 02 — CORREDOR RESTRITO"

        if (onPhaseChangedCallback) onPhaseChangedCallback(2)
        return false
      } else if (currentLevel === 2) {
        currentLevel = 3
        buildPortal(new THREE.Vector3(15, 0, 15))
        buildPhaseLayout(scene, 3)
        
        const phaseDisp = document.getElementById('phase-display')
        if (phaseDisp) phaseDisp.textContent = "FASE 03 — NÚCLEO DO PHOTOGRID"

        if (onPhaseChangedCallback) onPhaseChangedCallback(3)
        return false
      } else {
        won = true
        if (onVictoryCallback) onVictoryCallback()
        return true
      }
    }

    return false
  }

  function buildPhaseLayout(scene, phaseNumber) {
    // 1. Limpar obstáculos anteriores
    if (phaseNumber === 2) {
      // Limpar obstáculos padrão da cena 1 (tudo que for BoxGeometry que não for o cenário externo)
      const toRemove = []
      scene.children.forEach(c => {
        if (c.isMesh && c.geometry && c.geometry.type === 'BoxGeometry') {
          // Os muros gigantes da borda têm >= 60 de width ou depth
          if (c.geometry.parameters.width < 60 && c.geometry.parameters.depth < 60) {
            toRemove.push(c)
          }
        }
        if (c.type === 'LineSegments' && c.geometry && c.geometry.type === 'EdgesGeometry') {
          toRemove.push(c)
        }
      })
      toRemove.forEach(m => {
        if (m.geometry) m.geometry.dispose()
        scene.remove(m)
      })
    }

    // Limpar layout anterior de dase gerado dinamicamente
    phaseMeshes.forEach(m => {
      scene.remove(m)
      if (m.geometry) m.geometry.dispose()
    })
    phaseMeshes = []

    // 2. Construir novo layout
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x0c0c1e,
      emissive: 0x1a0040,
      emissiveIntensity: 0.3,
      roughness: 0.9,
      metalness: 0.1,
    })
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x3300aa, transparent: true, opacity: 0.5 })

    function addBoxWall(x, y, z, w, h, d) {
      const geo = new THREE.BoxGeometry(w, h, d)
      const mesh = new THREE.Mesh(geo, wallMat)
      mesh.position.set(x, y, z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      scene.add(mesh)
      phaseMeshes.push(mesh)

      const edgeGeo = new THREE.EdgesGeometry(geo)
      const edges = new THREE.LineSegments(edgeGeo, edgeMat)
      edges.position.set(x, y, z)
      scene.add(edges)
      phaseMeshes.push(edges)
    }

    if (phaseNumber === 2) {
      // Corredor central com 6 pares de paredes? Abertura alternando.
      const zPos = [-20, -10, 0, 10, 20]
      zPos.forEach((z, i) => {
        const isOpenLeft = (i % 2 === 0)
        // Paredes cruzadas para bloquear metade da pista: usando (8, 5, 1)? 
        // A instrução pedia BoxGeometry 1x5x8 com x=-4 e x=4
        const xVal = isOpenLeft ? 4 : -4
        addBoxWall(xVal, 2.5, z, 1, 5, 8)
      })
    } else if (phaseNumber === 3) {
      // Labirinto com BoxGeometry(12, 5, 1) e BoxGeometry(1, 5, 12)
      const hPos = [
        [-15, 2.5, -15], [-3, 2.5, -15], [9, 2.5, -15],
        [-15, 2.5, -3], [3, 2.5, -3],
        [-15, 2.5, 9], [3, 2.5, 9]
      ]
      const vPos = [
        [-9, 2.5, -9], [9, 2.5, -9],
        [-3, 2.5, 3], [9, 2.5, 3]
      ]

      hPos.forEach(p => addBoxWall(p[0], p[1], p[2], 12, 5, 1))
      vPos.forEach(p => addBoxWall(p[0], p[1], p[2], 1, 5, 12))
    }
  }

  function reset() {
    won = false
    pulseTime = 0
    currentLevel = 1
    
    // Reconstrói portal na etapa 1
    buildPortal(EXIT_POSITION)
    buildPhaseLayout(scene, 1) // limpa eventuais lixos visuais das outras fases
    
    // Reseta HUD
    const objText = document.getElementById('objective-text')
    if (objText) objText.textContent = "▶ Alcance a saída"
    
    const phaseDisp = document.getElementById('phase-display')
    if (phaseDisp) phaseDisp.textContent = "FASE 01"

    if (onPhaseChangedCallback) onPhaseChangedCallback(1)
  }

  function onVictory(cb) {
    onVictoryCallback = cb
  }

  function getExitPosition() {
    return currentExitPosition.clone()
  }

  return { update, reset, onVictory, getExitPosition, onPhaseChanged }
}
