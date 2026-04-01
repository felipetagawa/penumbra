import * as THREE from 'three'

/**
 * enemySystem.js — Sistema de Inimigos: Drone de Fóton (Fase 4)
 * Fase 6: visual mais ameaçador — pulso agressivo, glow no alerta, SpotLight dinâmica
 */

const PATROL_SPEED   = 5.0
const SPOT_INTENSITY = 9
const SPOT_RANGE     = 14
const SPOT_ANGLE     = 0.38
const SPOT_PENUMBRA  = 0.35
const ALERT_TIMEOUT  = 6
const DRONE_HEIGHT   = 3.2

export function createEnemySystem(scene) {
  const enemies = []
  const raycaster = new THREE.Raycaster()

  function spawnDrone(patrolA, patrolB) {
    // --- Corpo — octaedro metálico ---
    const bodyGeo = new THREE.OctahedronGeometry(0.38, 0)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xff8800,
      emissive: 0xff4400,
      emissiveIntensity: 0.8,
      metalness: 0.9,
      roughness: 0.15,
    })
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    body.castShadow = true

    // --- Anel giratório externo ---
    const ringGeo = new THREE.TorusGeometry(0.58, 0.07, 10, 32)
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      emissive: 0xff3300,
      emissiveIntensity: 0.6,
      metalness: 0.8,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)

    // --- Anel interno menor (gira na outra direção) ---
    const ring2Geo = new THREE.TorusGeometry(0.35, 0.04, 8, 24)
    const ring2Mat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xffaa00,
      emissiveIntensity: 0.5,
    })
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat)

    // Meshes próprios para filtrar raycasting
    const ownMeshes = new Set([body, ring, ring2])

    // --- Pivot ---
    const pivot = new THREE.Group()
    pivot.add(body)
    pivot.add(ring)
    pivot.add(ring2)

    const startPos = patrolA.clone()
    startPos.y = DRONE_HEIGHT
    pivot.position.copy(startPos)
    scene.add(pivot)

    // --- SpotLight ---
    const spotLight = new THREE.SpotLight(0xff9900, SPOT_INTENSITY, SPOT_RANGE, SPOT_ANGLE, SPOT_PENUMBRA)
    spotLight.castShadow = true
    spotLight.shadow.mapSize.width  = 512
    spotLight.shadow.mapSize.height = 512
    spotLight.shadow.camera.near    = 0.5
    spotLight.shadow.camera.far     = SPOT_RANGE

    const spotTarget = new THREE.Object3D()
    scene.add(spotTarget)
    spotLight.target = spotTarget
    pivot.add(spotLight)

    // --- Indicador de alerta (esfera vermelha pulsante) ---
    const alertGeo = new THREE.SphereGeometry(0.2, 10, 10)
    const alertMat = new THREE.MeshBasicMaterial({ color: 0xff1100, transparent: true, opacity: 0 })
    const alertSphere = new THREE.Mesh(alertGeo, alertMat)
    alertSphere.position.y = 0.65
    pivot.add(alertSphere)

    // --- lightEntry compatível com lightSystem ---
    const lightEntry = {
      pointLight: spotLight,
      position:   new THREE.Vector3(),
      color:      0xff9900,
      intensity:  SPOT_INTENSITY,
      range:      SPOT_RANGE / 3,
      interactable: false,
      on: true,
    }

    enemies.push({
      pivot, body, bodyMat, ring, ringMat, ring2, ring2Mat,
      spotLight, spotTarget, alertSphere, ownMeshes, lightEntry,
      patrolA: patrolA.clone(),
      patrolB: patrolB.clone(),
      direction: 1,
      state: 'patrol',
      alertTimer: 0,
      pulseTime: 0,
    })

    return enemies[enemies.length - 1]
  }

  // -----------------------------------------------------------------
  function spawnHunter(startPos) {
    // --- Corpo — esfera vermelha ---
    const bodyGeo = new THREE.SphereGeometry(0.28, 16, 16)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xcc0044,
      emissive: 0xcc0044,
      emissiveIntensity: 1.2,
      metalness: 0.7,
      roughness: 0.2,
    })
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    body.castShadow = true

    // Meshes para filtrar raycasting (sem anéis)
    const ownMeshes = new Set([body])

    // --- Pivot ---
    const pivot = new THREE.Group()
    pivot.add(body)

    const pos = startPos.clone()
    pos.y = DRONE_HEIGHT
    pivot.position.copy(pos)
    scene.add(pivot)

    // --- SpotLight vermelha ---
    const spotLight = new THREE.SpotLight(0xff0022, SPOT_INTENSITY * 1.4, 10, 0.28, SPOT_PENUMBRA)
    spotLight.castShadow = true
    spotLight.shadow.mapSize.width  = 512
    spotLight.shadow.mapSize.height = 512
    spotLight.shadow.camera.near    = 0.5
    spotLight.shadow.camera.far     = 10

    const spotTarget = new THREE.Object3D()
    scene.add(spotTarget)
    spotLight.target = spotTarget
    pivot.add(spotLight)

    // --- Sem esfera de alerta visível — hunter sempre está em alerta ---
    const alertGeo = new THREE.SphereGeometry(0.15, 8, 8)
    const alertMat = new THREE.MeshBasicMaterial({ color: 0xff0022, transparent: true, opacity: 0.8 })
    const alertSphere = new THREE.Mesh(alertGeo, alertMat)
    alertSphere.position.y = 0.45
    pivot.add(alertSphere)

    // --- lightEntry ---
    const lightEntry = {
      pointLight: spotLight,
      position:   new THREE.Vector3(),
      color:      0xff0022,
      intensity:  SPOT_INTENSITY * 1.4,
      range:      10 / 3,
      interactable: false,
      on: true,
    }

    enemies.push({
      pivot, body, bodyMat,
      ring: null, ringMat: null, ring2: null, ring2Mat: null,
      spotLight, spotTarget, alertSphere, ownMeshes, lightEntry,
      patrolA: startPos.clone(),
      patrolB: startPos.clone(),
      direction: 1,
      state: 'alert',
      alertTimer: Infinity,
      pulseTime: 0,
      hunterSpeed: 4.5,
      isHunter: true,
      detectionAngleMult: 3.0,
    })

    return enemies[enemies.length - 1]
  }

  // -----------------------------------------------------------------
  function update(delta, playerPosition, obstacles) {
    let detectedByEnemy = false
    let maxDetectionExposure = 0

    for (const enemy of enemies) {
      const {
        pivot, body, bodyMat, ring, ringMat, ring2, ring2Mat,
        spotLight, spotTarget, alertSphere, ownMeshes, lightEntry,
        patrolA, patrolB
      } = enemy

      // ---- Movimento (patrulha ou perseguição) ----
      const target = (enemy.state === 'alert')
        ? new THREE.Vector3(playerPosition.x, DRONE_HEIGHT, playerPosition.z)
        : (enemy.direction === 1 ? enemy.patrolB : enemy.patrolA)
          .clone().setY(DRONE_HEIGHT)
      const targetPos = target
      const toTarget  = new THREE.Vector3().subVectors(targetPos, pivot.position)
      const dist      = toTarget.length()

      if (enemy.state !== 'alert' && dist < 0.3) {
        enemy.direction *= -1
      } else {
        const speed = enemy.hunterSpeed ?? PATROL_SPEED
        const step = toTarget.normalize().multiplyScalar(speed * delta)
        pivot.position.add(step)
      }

      // ---- Timer de pulso ----
      enemy.pulseTime += delta
      const pt = enemy.pulseTime

      // ---- Flutuação vertical ----
      pivot.position.y = DRONE_HEIGHT + Math.sin(pt * 2.0) * 0.14

      // ---- Animação dos anéis ----
      if (!enemy.isHunter) {
        ring.rotation.z  += delta * 2.2
        ring.rotation.x  += delta * 1.1
        ring2.rotation.z -= delta * 3.0
        ring2.rotation.y += delta * 1.4
      }

      // ---- Orientar na direção do movimento ----
      const moveDir = new THREE.Vector3().subVectors(targetPos, pivot.position)
      if (moveDir.lengthSq() > 0.01) {
        const angle = Math.atan2(moveDir.x, moveDir.z)
        pivot.rotation.y = THREE.MathUtils.lerp(pivot.rotation.y, angle, 0.1)
      }

      // ---- Alvo do SpotLight ----
      spotTarget.position.set(pivot.position.x, 0, pivot.position.z)

      // ---- Sincronizar lightEntry ----
      lightEntry.position.copy(pivot.position)

      // ---- Detecção do player ----
      const playerPos   = playerPosition.clone()
      playerPos.y -= 0.5
      const dronePos    = pivot.position.clone()
      const dirToPlayer = new THREE.Vector3().subVectors(playerPos, dronePos)
      const distToPlayer = dirToPlayer.length()

      let detected = false
      let detectionStrength = 0

      if (distToPlayer < SPOT_RANGE) {
        const droneDown = new THREE.Vector3(0, -1, 0)
        const dirNorm   = dirToPlayer.clone().normalize()
        const angleToPayer = droneDown.angleTo(dirNorm)
        const detectionMult = enemy.detectionAngleMult ?? 1.5

        if (angleToPayer < SPOT_ANGLE * detectionMult) {
          raycaster.set(dronePos, dirNorm)
          raycaster.far = distToPlayer
          const filteredObstacles = obstacles.filter(o => !ownMeshes.has(o))
          const hits = raycaster.intersectObjects(filteredObstacles, false)

          if (hits.length === 0) {
            const falloff = 1 - Math.min(distToPlayer / SPOT_RANGE, 1)
            detectionStrength = falloff * 0.9
            detected = true
          }
        }
      }

      // ---- Estado ----
      if (detected) {
        enemy.state = 'alert'
        enemy.alertTimer = ALERT_TIMEOUT
        detectedByEnemy = true
        maxDetectionExposure = Math.max(maxDetectionExposure, detectionStrength)
      } else if (enemy.state === 'alert') {
        enemy.alertTimer -= delta
        if (enemy.alertTimer <= 0) {
          enemy.state = 'patrol'
          enemy.alertTimer = 0
        }
      }

      // ---- Visuais dependentes do estado ----
      if (enemy.state === 'alert') {
        // Pulso vermelho agressivo no corpo
        const alertPulse = (Math.sin(pt * (enemy.isHunter ? 20 : 14)) + 1) * 0.5
        bodyMat.emissive.set(enemy.isHunter ? 0xcc0044 : 0xff0000)
        bodyMat.emissiveIntensity = 0.6 + alertPulse * (enemy.isHunter ? 2.0 : 1.4)
        // Escala do corpo — vibração
        const vib = 1 + (Math.random() - 0.5) * 0.04
        body.scale.setScalar(vib)

        if (!enemy.isHunter) {
          // Anel brilhando vermelho (apenas drones normais)
          ringMat.emissive.set(0xff0000)
          ringMat.emissiveIntensity = 0.5 + alertPulse * 0.8
          ring2Mat.emissive.set(0xff2200)
          ring2Mat.emissiveIntensity = 0.6 + alertPulse
        }

        // Esfera de alerta pulsando
        alertSphere.material.opacity = enemy.isHunter
          ? 0.6 + alertPulse * 0.4
          : 0.5 + alertPulse * 0.5
        alertSphere.material.color.set(enemy.isHunter ? 0xff0022 : 0xff0000)

        // SpotLight: vermelho, intensidade alta pulsante
        spotLight.color.set(enemy.isHunter ? 0xff0022 : 0xff2200)
        spotLight.intensity = SPOT_INTENSITY * 1.6 + alertPulse * 3.0

      } else {
        // Patrulha — cor laranja, pulso suave
        const patrolPulse = (Math.sin(pt * 3.0) + 1) * 0.5
        bodyMat.emissive.set(0xff4400)
        bodyMat.emissiveIntensity = 0.5 + patrolPulse * 0.4
        body.scale.setScalar(1.0)

        if (!enemy.isHunter) {
          ringMat.emissive.set(0xff3300)
          ringMat.emissiveIntensity = 0.3 + patrolPulse * 0.4
          ring2Mat.emissive.set(0xffaa00)
          ring2Mat.emissiveIntensity = 0.2 + patrolPulse * 0.3
        }

        alertSphere.material.opacity = 0

        spotLight.color.set(0xff9900)
        spotLight.intensity = SPOT_INTENSITY + patrolPulse * 2.5
      }
    }

    return { detectedByEnemy, detectionExposure: maxDetectionExposure }
  }

  function getEnemyLightEntries() {
    return enemies.map(e => e.lightEntry)
  }

  spawnDrone(new THREE.Vector3(-10, 0, 0), new THREE.Vector3(10, 0, 0))
  spawnDrone(new THREE.Vector3(0, 0, -10), new THREE.Vector3(0, 0, 10))
  spawnHunter(new THREE.Vector3(-15, 0, -15))

  function getAlertState() {
    // Retorna true somente se um DRONE NORMAL (patrulha) estiver em alerta,
    // caso contrário o Global Alert ficaria ligado 100% do tempo por conta do Hunter.
    return enemies.some(e => e.state === 'alert' && !e.isHunter)
  }

  function resetEnemyPatrols(phase) {
    if (phase === 1) {
      enemies[0].patrolA.set(-10, 0, 0); enemies[0].patrolB.set(10, 0, 0);
      enemies[1].patrolA.set(0, 0, -10); enemies[1].patrolB.set(0, 0, 10);
      enemies[2].patrolA.set(-15, 0, -15); enemies[2].patrolB.set(-15, 0, -15);
    } else if (phase === 2) {
      // Fase Corredor
      enemies[0].patrolA.set(0, 0, 5); enemies[0].patrolB.set(0, 0, 20);
      enemies[1].patrolA.set(0, 0, -20); enemies[1].patrolB.set(0, 0, -5);
      enemies[2].patrolA.set(-10, 0, 10); enemies[2].patrolB.set(-10, 0, -10);
    } else if (phase === 3) {
      // Labirinto
      enemies[0].patrolA.set(-9, 0, -3); enemies[0].patrolB.set(-9, 0, 9);
      enemies[1].patrolA.set(3, 0, -9); enemies[1].patrolB.set(-9, 0, -9);
      enemies[2].patrolA.set(9, 0, 9); enemies[2].patrolB.set(9, 0, 9);
    }

    enemies.forEach(enemy => {
      enemy.pivot.position.set(enemy.patrolA.x, DRONE_HEIGHT, enemy.patrolA.z);
      enemy.direction = 1;
      enemy.state = (enemy.isHunter) ? 'alert' : 'patrol';
      enemy.alertTimer = (enemy.isHunter) ? Infinity : 0;
    });
  }

  return { update, getEnemyLightEntries, getAlertState, resetEnemyPatrols }
}
