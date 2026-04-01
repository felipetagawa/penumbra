import * as THREE from 'three'

/**
 * player.js — Controle do jogador (UMBRA-7)
 * Movimento FPS com mouse look e colisão simples
 */

export function createPlayer(camera, scene) {
  // Estado de input
  const keys = {
    w: false, a: false, s: false, d: false
  }

  // Rotação da câmera
  const euler = new THREE.Euler(0, 0, 0, 'YXZ')
  const MOVE_SPEED = 6
  const MOUSE_SENSITIVITY = 0.002

  // Inicializa numa posição segura (canto escuro, longe das luzes)
  camera.position.set(-20, 1.7, -20)

  let isLocked = false

  // --- Pointer Lock ---
  document.addEventListener('click', () => {
    document.body.requestPointerLock()
  })

  document.addEventListener('pointerlockchange', () => {
    isLocked = document.pointerLockElement === document.body
  })

  // --- Mouse look ---
  document.addEventListener('mousemove', (e) => {
    if (!isLocked) return

    euler.setFromQuaternion(camera.quaternion)
    euler.y -= e.movementX * MOUSE_SENSITIVITY
    euler.x -= e.movementY * MOUSE_SENSITIVITY

    // Limitar pitch (para não girar de cabeça pra baixo)
    euler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, euler.x))

    camera.quaternion.setFromEuler(euler)
  })

  // --- Teclado ---
  document.addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'KeyW': keys.w = true; break
      case 'KeyA': keys.a = true; break
      case 'KeyS': keys.s = true; break
      case 'KeyD': keys.d = true; break
    }
  })

  document.addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'KeyW': keys.w = false; break
      case 'KeyA': keys.a = false; break
      case 'KeyS': keys.s = false; break
      case 'KeyD': keys.d = false; break
    }
  })

  // Vetores reutilizáveis
  const direction = new THREE.Vector3()
  const forward = new THREE.Vector3()
  const right = new THREE.Vector3()

  // Limites do cenário (paredes)
  const BOUNDS = 28.5

  function update(delta) {
    if (!isLocked) return

    direction.set(0, 0, 0)

    // Direção frontal e lateral (ignorando eixo Y da câmera)
    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()

    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

    if (keys.w) direction.add(forward)
    if (keys.s) direction.sub(forward)
    if (keys.a) direction.sub(right)
    if (keys.d) direction.add(right)

    if (direction.lengthSq() > 0) {
      direction.normalize()
      const velocity = direction.multiplyScalar(MOVE_SPEED * delta)
      camera.position.add(velocity)

      // Limitar dentro das paredes
      camera.position.x = Math.max(-BOUNDS, Math.min(BOUNDS, camera.position.x))
      camera.position.z = Math.max(-BOUNDS, Math.min(BOUNDS, camera.position.z))
    }

    // Manter altura fixa (chão)
    camera.position.y = 1.7
  }

  return { update, camera }
}
