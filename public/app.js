
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
  

  // drag & drop functionaliteit voor het uploaden van SVG bestanden, en ook een click event voor het selecteren van bestanden via de file input
  ;['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault()
      dropZone.classList.add('drag-over')
    }, false)
  })

  ;['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault()
      dropZone.classList.remove('drag-over')
    }, false)
  })
  // event listener voor het droppen van bestanden in de dropzone
  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer
    const files = dt.files
    if (files.length) handleFile(files[0])
  })

  fileInput.addEventListener('change', (e) => {
    if (fileInput.files.length) handleFile(fileInput.files[0])
  })
// functie die word aangeroepen bij het uploaden van een bestand, als het geen svg bestand is krijg de gebruiker een alert
  function handleFile (file) {
    if (!file.name.endsWith('.svg')) {
      alert('Alleen svg bestanden worden geaccepteerd.')
      return
    }

    const formData = new FormData()
    formData.append('svgfile', file)

    // het schoon maken van de oude resultaten en het tonen van een niewe svg status
    appContainer.className = 'app-container'
    errorList.innerHTML = ''
    componentTree.innerHTML = ''
    statusBadge.textContent = 'Analyseren...'

    // het sturen van een bestand naar de server voor validatie, en het verwerken van het antwoord van de server 
    fetch('/api/validate', {
      method: 'POST',
      body: formData
    })

    // het verwerken van het antwoord van de server en het weergeven van de resultaten
    .then(res => res.json())
    .then(data => {
      renderResult(data)
    })
    .catch(err => {
      console.error(err)
      statusBadge.textContent = 'Fout bij verbinden'
    })
  }

  function buildTree (xmlNode, container) {
    if (xmlNode.nodeType !== 1) return

    const children = Array.from(xmlNode.childNodes).filter(n => n.nodeType === 1)
    const hasChildren = children.length > 0

    let nodeText = `&lt;${xmlNode.tagName}`
    if (xmlNode.hasAttribute('id')) {
      nodeText += ` <span class="tree-attr">id="${xmlNode.getAttribute('id')}"</span>`
    }
    if (xmlNode.hasAttribute('class')) {
      nodeText += ` <span class="tree-attr">class="${xmlNode.getAttribute('class')}"</span>`
    }
    nodeText += `&gt;`

    if (hasChildren) {
      const detailsEl = document.createElement('details')
      detailsEl.open = true 

      const summaryEl = document.createElement('summary')
      summaryEl.innerHTML = nodeText
      detailsEl.appendChild(summaryEl)

      container.appendChild(detailsEl)
      children.forEach(child => buildTree(child, detailsEl))
    } else {
      const leafDiv = document.createElement('div')
      leafDiv.className = 'tree-leaf'
      leafDiv.innerHTML = nodeText
      container.appendChild(leafDiv)
    }
  }

  function renderResult (data) {
    prompt.style.display = 'none'
    svgPreview.style.display = 'flex'
    svgPreview.innerHTML = data.svgRaw

    const svgElement = svgPreview.querySelector('svg')
    let componentCount = 0

    if (svgElement) {
      buildTree(svgElement, componentTree)
      componentCount = svgElement.querySelectorAll('*').length + 1
    }

    if (data.valid) {
      appContainer.classList.add('state-success')
      statusBadge.textContent = `Geslaagd | ${componentCount} Componenten`
      errorList.innerHTML = '<div style="color: var(--success); text-align: center; margin-top: 2rem; font-weight:600;">✓ SVG is succesvol gevalideerd!</div>'
    } else {
      appContainer.classList.add('state-failed')
      statusBadge.textContent = `${data.errors.length} Fout(en) | ${componentCount} Componenten`

      data.errors.forEach(err => {
        const item = document.createElement('div')
        item.className = 'error-item'
        item.innerHTML = `<div class="message">${err.message}</div>`

        if (err.selector) {
          item.addEventListener('click', () => {
            svgPreview.querySelectorAll('.neon-glow-active').forEach(el => {
              el.classList.remove('neon-glow-active')
            })

            const targetEl = svgPreview.querySelector(err.selector)
            if (targetEl) {
              targetEl.classList.add('neon-glow-active')
            }
          })
        }
        errorList.appendChild(item)
      })
    }
  }

   // functie die de van XML boomstructuur opbouwt van de svg elementen, en deze weergeeft in de component tree aan de zijkant van de pagina 

  function buildTree (xmlNode, container) {
    if (xmlNode.nodeType !== 1) return

    const children = Array.from(xmlNode.childNodes).filter(n => n.nodeType === 1)
    const hasChildren = children.length > 0

    let nodeText = `&lt;${xmlNode.tagName}`
    if (xmlNode.hasAttribute('id')) {
      nodeText += ` <span class="tree-attr">id="${xmlNode.getAttribute('id')}"</span>`
    }
    if (xmlNode.hasAttribute('class')) {
      nodeText += ` <span class="tree-attr">class="${xmlNode.getAttribute('class')}"</span>`
    }
    nodeText += `&gt;`

    if (hasChildren) {
      const detailsEl = document.createElement('details')
      detailsEl.open = true 

      const summaryEl = document.createElement('summary')
      summaryEl.innerHTML = nodeText
      detailsEl.appendChild(summaryEl)

      container.appendChild(detailsEl)
      children.forEach(child => buildTree(child, detailsEl))
    } else {
      const leafDiv = document.createElement('div')
      leafDiv.className = 'tree-leaf'
      leafDiv.innerHTML = nodeText
      container.appendChild(leafDiv)
    }
  }

  function renderResult (data) {
    prompt.style.display = 'none'
    svgPreview.style.display = 'flex'
    svgPreview.innerHTML = data.svgRaw

    const svgElement = svgPreview.querySelector('svg')
    let componentCount = 0

    if (svgElement) {
      buildTree(svgElement, componentTree)
      componentCount = svgElement.querySelectorAll('*').length + 1
    }

    // het weergeven van de resultaten van de validatie, en het toevoegen van een click event aan elke
    // foutmelding zodat de gebruiker direct naar het element in de svg kan springen waar de fout zich bevindt

    if (data.valid) {
      appContainer.classList.add('state-success')
      statusBadge.textContent = `Geslaagd | ${componentCount} Componenten`
      errorList.innerHTML = '<div style="color: var(--success); text-align: center; margin-top: 2rem; font-weight:600;">✓ SVG is succesvol gevalideerd!</div>'
    } else {
      appContainer.classList.add('state-failed')
      statusBadge.textContent = `${data.errors.length} Fout(en) | ${componentCount} Componenten`

      data.errors.forEach(err => {
        const item = document.createElement('div')
        item.className = 'error-item'
        item.innerHTML = `<div class="message">${err.message}</div>`

        if (err.selector) {
          item.addEventListener('click', () => {
            svgPreview.querySelectorAll('.neon-glow-active').forEach(el => {
              el.classList.remove('neon-glow-active')
            })

            const targetEl = svgPreview.querySelector(err.selector)
            if (targetEl) {
              targetEl.classList.add('neon-glow-active')
            }
          })
        }
        errorList.appendChild(item)
      })
    }
  }
})