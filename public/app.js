
/* hoofdbestanden voor de svg validator */
document.addEventListener('DOMContentLoaded', () => {

  // dom elementen voor inloggen
  const loginPage = document.getElementById('loginPage')
  const loginForm = document.getElementById('loginForm')
  const loginError = document.getElementById('loginError')
  
  // de dom elementen voor de validator
  const appContainer = document.getElementById('app')
  const dropZone = document.getElementById('dropZone')
  const fileInput = document.getElementById('fileInput')
  const svgPreview = document.getElementById('svgPreview')
  const prompt = document.querySelector('.drop-zone-prompt')
  const errorList = document.getElementById('errorList')
  const statusBadge = document.getElementById('statusBadge')
  const componentTree = document.getElementById('componentTree')

  // inloggegevens voor de login page
  const GELDIGE_GEBRUIKERSNAAM = 'zoheb'
  const GELDIG_WACHTWOORD = 'zoheb'

  // als de inloggegevens kloppen dan word de vadilator pagina getoond
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault()
    
    const usernameInput = document.getElementById('username').value.trim()
    const passwordInput = document.getElementById('password').value

    if (usernameInput === GELDIGE_GEBRUIKERSNAAM && passwordInput === GELDIG_WACHTWOORD) {
      loginPage.style.opacity = '0'
      loginPage.style.transform = 'scale(0.98)'
      
      setTimeout(() => {
        loginPage.style.display = 'none'
        appContainer.classList.remove('app-hidden')
      }, 400)
    } else {
      loginError.textContent = 'Onjuiste gebruikersnaam of wachtwoord.'
    }
  })  