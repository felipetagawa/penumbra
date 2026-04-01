/**
 * ui.js — Interface (HUD): barra de integridade, status de sombra/luz
 */

const integrityBar = document.getElementById('integrity-bar')
const integrityValue = document.getElementById('integrity-value')
const shadowStatus = document.getElementById('shadow-status')
const gameOverScreen = document.getElementById('game-over')
const timerHud = document.getElementById('hud-timer')
const scoreHud = document.getElementById('hud-score')

export function formatTime(t) {
  const m = Math.floor(t / 60).toString().padStart(2, '0')
  const s = Math.floor(t % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function updateHUD(integrityPercent, inLight, score, timer) {
  // Barra de integridade
  integrityBar.style.width = `${integrityPercent}%`

  // Cor de perigo quando baixa
  if (integrityPercent < 30) {
    integrityBar.classList.add('danger')
  } else {
    integrityBar.classList.remove('danger')
  }

  integrityValue.textContent = `${Math.round(integrityPercent)}%`

  // Status sombra/luz
  if (inLight) {
    shadowStatus.textContent = '● Luz — PERIGO'
    shadowStatus.className = 'danger'
    shadowStatus.id = 'shadow-status'
  } else {
    shadowStatus.textContent = '● Sombra'
    shadowStatus.className = 'safe'
    shadowStatus.id = 'shadow-status'
  }

  // Timer e Score
  if (timerHud) timerHud.textContent = formatTime(timer)
  if (scoreHud) scoreHud.textContent = `SCORE  ${score}`
}

export function setVictoryStats(score, timer) {
  const statsEl = document.getElementById('victory-stats')
  if (statsEl) {
    statsEl.innerHTML = `SCORE: ${score}<br>TEMPO: ${formatTime(timer)}`
  }
}

export function showGameOver() {
  gameOverScreen.classList.add('visible')
}

export function hideGameOver() {
  gameOverScreen.classList.remove('visible')
}
