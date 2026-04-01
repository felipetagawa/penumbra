import * as THREE from 'three'

/**
 * scene.js — Setup e configuração da cena 3D
 */
export function createScene() {
  // Cena com névoa escura — reforça o clima de penumbra
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x050508)
  scene.fog = new THREE.FogExp2(0x050508, 0.04)

  return scene
}

export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ReinhardToneMapping
  renderer.toneMappingExposure = 0.8
  document.body.appendChild(renderer.domElement)

  // Redimensionar com a janela
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  return renderer
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  )
  camera.position.set(0, 1.7, 0) // altura dos olhos

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
  })

  return camera
}

export function buildLevel(scene) {
  // --- Chão ---
  const floorGeo = new THREE.PlaneGeometry(60, 60)
  const floorMat = new THREE.MeshLambertMaterial({ color: 0x0d0d14 })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  // --- Teto ---
  const ceilGeo = new THREE.PlaneGeometry(60, 60)
  const ceilMat = new THREE.MeshLambertMaterial({ color: 0x08080f })
  const ceil = new THREE.Mesh(ceilGeo, ceilMat)
  ceil.rotation.x = Math.PI / 2
  ceil.position.y = 5
  ceil.receiveShadow = true
  scene.add(ceil)

  // --- Paredes externas ---
  buildWalls(scene)

  // --- Obstáculos / pilares --- criam zonas de sombra naturais
  buildObstacles(scene)
}

function buildWalls(scene) {
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x0a0a12 })
  const wallConfigs = [
    // [largura, altura, profundidade, x, y, z, rotY]
    [60, 5, 0.5,  0, 2.5, -30,  0],  // frente
    [60, 5, 0.5,  0, 2.5,  30,  0],  // fundo
    [0.5, 5, 60, -30, 2.5,  0, 0],   // esquerda
    [0.5, 5, 60,  30, 2.5,  0, 0],   // direita
  ]

  wallConfigs.forEach(([w, h, d, x, y, z]) => {
    const geo = new THREE.BoxGeometry(w, h, d)
    const mesh = new THREE.Mesh(geo, wallMat)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
  })
}

function buildObstacles(scene) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x111120 })

  const pillars = [
    [-8, 0, -8],
    [ 8, 0, -8],
    [-8, 0,  8],
    [ 8, 0,  8],
    [ 0, 0, -15],
    [ 0, 0,  15],
    [-15, 0, 0],
    [ 15, 0, 0],
  ]

  pillars.forEach(([x, , z]) => {
    const geo = new THREE.BoxGeometry(1.5, 5, 1.5)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, 2.5, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
  })

  // Caixas baixas para mais variedade de sombra
  const boxes = [
    [-5, 0, -5, 2, 1, 2],
    [ 5, 0,  5, 3, 0.8, 1],
    [-5, 0,  5, 1, 1.2, 3],
    [12, 0, -6, 2, 1.5, 2],
    [-12, 0, 6, 3, 1, 2],
  ]

  boxes.forEach(([x, , z, w, h, d]) => {
    const geo = new THREE.BoxGeometry(w, h, d)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, h / 2, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
  })
}
