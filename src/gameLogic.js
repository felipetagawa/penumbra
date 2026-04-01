/**
 * gameLogic.js — Regras do jogo: integridade, dano, game over e restart
 */

const MAX_INTEGRITY = 100
const DAMAGE_PER_SECOND = 18    // dano por segundo na luz
const HEAL_PER_SECOND = 5       // recuperação lenta na sombra (feedback positivo)
const SPAWN_INVINCIBILITY = 3   // segundos de invencibilidade ao spawnar

export function createGameLogic() {
  let integrity = MAX_INTEGRITY
  let isGameOver = false
  let onRestartCallback = null
  let spawnTimer = SPAWN_INVINCIBILITY // contagem regressiva de invencibilidade

  const restartBtn = document.getElementById('restart-btn')
  restartBtn.addEventListener('click', () => {
    if (onRestartCallback) onRestartCallback()
  })

  /**
   * Atualiza a integridade do jogador baseado no estado de luz.
   * @param {number} delta — tempo do frame em segundos
   * @param {boolean} inLight — se o player está na luz
   * @param {number} exposureLevel — 0 a 1, nível de exposição à luz
   * @returns {boolean} — true se o jogador morreu neste frame
   */
  function update(delta, inLight, exposureLevel) {
    if (isGameOver) return false

    // Invencibilidade no spawn
    if (spawnTimer > 0) {
      spawnTimer -= delta
      return false
    }

    if (inLight) {
      // Dano proporcional à exposição
      integrity -= DAMAGE_PER_SECOND * exposureLevel * delta
    } else {
      // Recuperação lenta na sombra
      integrity = Math.min(MAX_INTEGRITY, integrity + HEAL_PER_SECOND * delta)
    }

    integrity = Math.max(0, integrity)

    if (integrity <= 0) {
      isGameOver = true
      return true // morreu
    }

    return false
  }

  function getIntegrity() {
    return integrity
  }

  function getIntegrityPercent() {
    return (integrity / MAX_INTEGRITY) * 100
  }

  function restart() {
    integrity = MAX_INTEGRITY
    isGameOver = false
    spawnTimer = SPAWN_INVINCIBILITY
  }

  function onRestart(callback) {
    onRestartCallback = callback
  }

  function getIsGameOver() {
    return isGameOver
  }

  return {
    update,
    getIntegrity,
    getIntegrityPercent,
    restart,
    onRestart,
    getIsGameOver
  }
}
