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

  // drag & drop functionaliteit voor het uploaden van SVG bestanden
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

  // functie die word aangeroepen bij het uploaden van een bestand
  function handleFile (file) {
    if (!file.name.endsWith('.svg')) {
      alert('Alleen svg bestanden worden geaccepteerd.')
      return
    }

    const formData = new FormData()
    formData.append('svgfile', file)

    // Het schoon maken van de oude resultaten en het tonen van een nieuwe svg status
    appContainer.className = 'app-container'
    dropZone.classList.remove('has-svg') // Reset klik-blokkade bij nieuwe upload
    errorList.innerHTML = ''
    componentTree.innerHTML = ''
    statusBadge.textContent = 'Analyseren...'

    // Verwijder eventuele oude zoom knoppen als die er nog stonden
    const oldControls = dropZone.querySelector('.zoom-controls')
    if (oldControls) oldControls.remove()

    // het sturen van een bestand naar de server voor validatie
    fetch('/api/validate', {
      method: 'POST',
      body: formData
    })
    .then(res => res.json())
    .then(data => {
      renderResult(data)
    })
    .catch(err => {
      console.error(err)
      statusBadge.textContent = 'Fout bij verbinden'
    })
  }

  // functie die de XML boomstructuur opbouwt van de svg elementen
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

  // Resultaten weergeven en koppelen aan de interactieve sidebar
  function renderResult (data) {
    prompt.style.display = 'none'
    svgPreview.style.display = 'flex'
    svgPreview.innerHTML = data.svgRaw

    const svgElement = svgPreview.querySelector('svg')
    let componentCount = 0

    if (svgElement) {
      buildTree(svgElement, componentTree)
      componentCount = svgElement.querySelectorAll('*').length + 1
      
      // Maak en activeer de zoom & sleep functionaliteit + knoppen
      initSvgZoom(svgElement)
      
      // Blokkeer het onzichtbare upload-veld zodat je niet per ongeluk opnieuw uploadt bij klikken
      dropZone.classList.add('has-svg')
    }

    if (data.valid) {
      appContainer.classList.add('state-success')
      statusBadge.textContent = `Geslaagd | ${componentCount} Componenten`
      errorList.innerHTML = '<div style="color: var(--success); text-align: center; margin-top: 2rem; font-weight:600;">✓ SVG is succesvol gevalideerd!</div>'
    } else {
      appContainer.classList.add('state-failed')
      statusBadge.textContent = `${data.errors.length} Fout(en) | ${componentCount} Componenten`

      data.errors.forEach(err => {
        // HIER IS DE FIX VAN JE BAAS TOEGEPAST:
        const item = document.createElement('div')
        item.className = 'error-item'
        
        const msgEl = document.createElement('div')
        msgEl.className = 'message'
        msgEl.textContent = err.message // Veilig als platte tekst injecteren
        item.appendChild(msgEl)

        if (err.selector) {
          item.addEventListener('click', (e) => {
            e.stopPropagation()
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

  // Geavanceerde Zoom & Pan (Slepen) functionaliteit + Slimme reset zonder uitloggen
  function initSvgZoom(svgElement) {
    let scale = 1
    let translateX = 0
    let translateY = 0
    
    // Statusvariabelen voor het slepen
    let isDragging = false
    let startX = 0
    let startY = 0

    const MIN_SCALE = 0.4
    const MAX_SCALE = 6
    const ZOOM_SPEED = 0.12

    // Maak de HTML knoppen dynamisch aan en voeg ze toe aan de dropzone container
    const controls = document.createElement('div')
    controls.className = 'zoom-controls'
    controls.innerHTML = `
      <button id="newSvgBtn" class="refresh-btn" title="Laat nieuwe SVG">🗑</button>
      <div class="zoom-button-group">
        <button id="zoomInBtn" title="Inzoomen">+</button>
        <button id="zoomOutBtn" title="Uitzoomen">−</button>
        <button id="zoomResetBtn" title="Reset Zoom">↺</button>
      </div>
    `
    dropZone.appendChild(controls)

    // Zet het middelpunt vast
    svgElement.style.transformOrigin = 'center center'
    updateTransform()

    // Update functie die zowel zoom (scale) als verschuiving (translate) toepast
    function updateTransform() {
      svgElement.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`
    }

    // Muiswiel Zoom
    svgPreview.addEventListener('wheel', (e) => {
      e.preventDefault()

      const rect = svgPreview.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const svgX = (mouseX - rect.width / 2 - translateX) / scale
      const svgY = (mouseY - rect.height / 2 - translateY) / scale

      const oldScale = scale
      if (e.deltaY < 0) {
        scale += ZOOM_SPEED
      } else {
        scale -= ZOOM_SPEED
      }
      scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale))

      translateX += svgX * (oldScale - scale)
      translateY += svgY * (oldScale - scale)

      updateTransform()
    }, { passive: false })

    // Sleep en beweeg functionaliteit (Pan)
    svgPreview.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return 
      
      isDragging = true
      svgPreview.classList.add('grabbing')
      
      startX = e.clientX - translateX
      startY = e.clientY - translateY
    })

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return
      translateX = e.clientX - startX
      translateY = e.clientY - startY
      updateTransform()
    })

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false
        svgPreview.classList.remove('grabbing')
      }
    })

    // Knoppen functionaliteit
    document.getElementById('zoomInBtn').addEventListener('click', (e) => {
      e.stopPropagation()
      scale = Math.min(MAX_SCALE, scale + 0.3)
      updateTransform()
    })

    document.getElementById('zoomOutBtn').addEventListener('click', (e) => {
      e.stopPropagation()
      scale = Math.max(MIN_SCALE, scale - 0.3)
      updateTransform()
    })

    document.getElementById('zoomResetBtn').addEventListener('click', (e) => {
      e.stopPropagation()
      resetZoom()
    })

    // --- FIX: RESET APP ZONDER REFRESH (GEEN RE-LOGIN NODIG) ---
    document.getElementById('newSvgBtn').addEventListener('click', (e) => {
      e.stopPropagation()
      
      // 1. Maak de preview leeg en verberg deze weer
      svgPreview.innerHTML = ''
      svgPreview.style.display = 'none'
      
      // 2. Toon de originele upload-tekst (prompt) weer
      prompt.style.display = 'flex'
      
      // 3. Reset het uploadveld en geef de dropzone zijn klik-functie terug
      fileInput.value = ''
      dropZone.classList.remove('has-svg')
      
      // 4. Maak de componentenboom en de foutenlijst leeg
      componentTree.innerHTML = '<span class="tree-placeholder">Upload een SVG om de componenten boom te bekijken...</span>'
      errorList.innerHTML = ''
      
      // 5. Reset status badges en app-achtergrondkleuren naar de beginstand
      statusBadge.textContent = 'Wachten op SVG bestand...'
      appContainer.className = 'app-container'
      
      // 6. Verwijder tot slot de knoppen-interface tot er een nieuwe SVG komt
      controls.remove()
    })

    svgPreview.addEventListener('dblclick', () => {
      resetZoom()
    })

    function resetZoom() {
      scale = 1
      translateX = 0
      translateY = 0
      updateTransform()
    }
  }
})