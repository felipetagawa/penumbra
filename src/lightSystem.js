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

const INTERACT_RANGE = 6      // distância máxima para interagir com a luz
const HIGHLIGHT_RANGE = 8     // distância para começar a mostrar highlight

export function createLightSystem(scene) {
  const lights = []           // lista de objetos de luz gerenciados

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

    lights.push({
      pointLight,
      sphere,
      halo,
      position: new THREE.Vector3(x, y, z),
      color,
      intensity,
      range,
      interactable,
      on: true,
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
  // toggleLight — liga/desliga uma luz específica
  // -----------------------------------------------------------------
  function toggleLight(entry) {
    if (!entry || !entry.interactable) return

    entry.on = !entry.on

    // Ligar/desligar o PointLight
    entry.pointLight.intensity = entry.on ? entry.intensity : 0

    // Atualizar visual da esfera
    if (entry.on) {
      entry.sphere.material.color.set(entry.color)
      entry.sphere.material.opacity = 1
    } else {
      // Esfera fica cinza escuro quando desligada
      entry.sphere.material.color.set(0x222233)
    }
  }

  // -----------------------------------------------------------------
  // getLights — expõe a lista para raycasting de obstáculos
  // -----------------------------------------------------------------
  function getLights() {
    return lights
  }

  return { getLights, checkPlayerLight, toggleLight }
}
