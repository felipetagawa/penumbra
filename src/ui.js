/**
 * ui.js — Interface (HUD): barra de integridade, status de sombra/luz
 */

const integrityBar = document.getElementById('integrity-bar')
const integrityValue = document.getElementById('integrity-value')
const shadowStatus = document.getElementById('shadow-status')
const gameOverScreen = document.getElementById('game-over')

export function updateHUD(integrityPercent, inLight) {
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
}

export function showGameOver() {
  gameOverScreen.classList.add('visible')
}

export function hideGameOver() {
  gameOverScreen.classList.remove('visible')
}
