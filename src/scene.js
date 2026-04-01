import * as THREE from 'three'

/**
 * scene.js — Setup e configuração da cena 3D
 */
export function createScene() {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x02020a)     // quase preto azulado
  scene.fog = new THREE.FogExp2(0x02020a, 0.055)   // névoa mais densa

  return scene
}

export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ReinhardToneMapping
  renderer.toneMappingExposure = 1.1   // mais contraste entre luz e sombra

  document.body.appendChild(renderer.domElement)

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
  camera.position.set(0, 1.7, 0)

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
  })

  return camera
}

export function buildLevel(scene) {
  // --- Chão ---
  const floorGeo = new THREE.PlaneGeometry(60, 60)
  const floorMat = new THREE.MeshLambertMaterial({ color: 0x080810 })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  // Grid sutil no chão — linhas roxas muito fracas dão profundidade cyberpunk
  const gridHelper = new THREE.GridHelper(60, 30, 0x1a0a2e, 0x0d0520)
  gridHelper.position.y = 0.01
  scene.add(gridHelper)

  // --- Teto ---
  const ceilGeo = new THREE.PlaneGeometry(60, 60)
  const ceilMat = new THREE.MeshLambertMaterial({ color: 0x050508 })
  const ceil = new THREE.Mesh(ceilGeo, ceilMat)
  ceil.rotation.x = Math.PI / 2
  ceil.position.y = 5
  ceil.receiveShadow = true
  scene.add(ceil)

  // --- Paredes externas ---
  buildWalls(scene)

  // --- Obstáculos / pilares ---
  buildObstacles(scene)
}

function buildWalls(scene) {
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x09091a })
  const wallConfigs = [
    [60, 5, 0.5,  0, 2.5, -30,  0],
    [60, 5, 0.5,  0, 2.5,  30,  0],
    [0.5, 5, 60, -30, 2.5,  0, 0],
    [0.5, 5, 60,  30, 2.5,  0, 0],
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
  // Pilares: material escuro com emissão roxo-neon suave
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x0c0c1e,
    emissive: 0x1a0040,
    emissiveIntensity: 0.3,
    roughness: 0.9,
    metalness: 0.1,
  })

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
    const mesh = new THREE.Mesh(geo, pillarMat)
    mesh.position.set(x, 2.5, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)

    // Arestas do pilar — linha neon roxa fina
    const edgeGeo = new THREE.EdgesGeometry(geo)
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x3300aa, transparent: true, opacity: 0.5 })
    const edges = new THREE.LineSegments(edgeGeo, edgeMat)
    edges.position.set(x, 2.5, z)
    scene.add(edges)
  })

  // Caixas baixas
  const boxMat = new THREE.MeshStandardMaterial({
    color: 0x0e0e1c,
    emissive: 0x0d0025,
    emissiveIntensity: 0.2,
    roughness: 0.95,
  })

  const boxes = [
    [-5, 0, -5, 2, 1, 2],
    [ 5, 0,  5, 3, 0.8, 1],
    [-5, 0,  5, 1, 1.2, 3],
    [12, 0, -6, 2, 1.5, 2],
    [-12, 0, 6, 3, 1, 2],
  ]

  boxes.forEach(([x, , z, w, h, d]) => {
    const geo = new THREE.BoxGeometry(w, h, d)
    const mesh = new THREE.Mesh(geo, boxMat)
    mesh.position.set(x, h / 2, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)

    const edgeGeo = new THREE.EdgesGeometry(geo)
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x220066, transparent: true, opacity: 0.4 })
    const edges = new THREE.LineSegments(edgeGeo, edgeMat)
    edges.position.set(x, h / 2, z)
    scene.add(edges)
  })
}
