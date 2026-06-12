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
    dropZone.classList.remove('has-svg')
    errorList.innerHTML = ''
    componentTree.innerHTML = ''
    statusBadge.textContent = 'Analyseren...'

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

  // GEOPTIMALISEERDE FUNCTIE: Matcht nu exact met de selectors van server.js
  function buildTree (xmlNode, container, currentSelector = "svg", elementIndex = 1) {
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

    let wrapper;

    if (hasChildren) {
      const detailsEl = document.createElement('details')
      detailsEl.open = false 

      const summaryEl = document.createElement('summary')
      summaryEl.innerHTML = nodeText
      detailsEl.appendChild(summaryEl)

      container.appendChild(detailsEl)
      wrapper = detailsEl;

      // Zoek de directe hoofdgroepen (style, defs, g) op zoals de server dat doet
      let mainGNode = children.find(n => n.tagName === 'g' && n.getAttribute('class') !== 'click-area');

      children.forEach((child, index) => {
        let nextSelector = "";

        if (xmlNode.tagName === 'svg') {
          // Directe kinderen van SVG (zoals style, defs, of de hoofd-g)
          nextSelector = `svg > ${child.tagName}`;
        } else if (xmlNode === mainGNode || (xmlNode.tagName === 'g' && xmlNode.parentElement.tagName === 'svg' && xmlNode.getAttribute('class') !== 'click-area')) {
          // Elementen die direct onder de hoofdgroep <g> vallen gebruiken :nth-child in de server
          nextSelector = `svg > g > :nth-child(${index + 1})`;
        } else {
          // Dieper liggende sub-elementen
          nextSelector = `${currentSelector} > :nth-child(${index + 1})`;
        }

        buildTree(child, detailsEl, nextSelector, index + 1)
      })
    } else {
      const leafDiv = document.createElement('div')
      leafDiv.className = 'tree-leaf'
      leafDiv.innerHTML = nodeText
      container.appendChild(leafDiv)
      wrapper = leafDiv;
    }

    // Sla de berekende selector op in het HTML-element
    wrapper.setAttribute('data-selector', currentSelector);
  }

  // Resultaten weergeven en koppelen aan de interactieve sidebar + component tree
  function renderResult (data) {
    prompt.style.display = 'none'
    svgPreview.style.display = 'flex'
    svgPreview.innerHTML = data.svgRaw

    const svgElement = svgPreview.querySelector('svg')
    let componentCount = 0

    if (svgElement) {
      buildTree(svgElement, componentTree)
      componentCount = svgElement.querySelectorAll('*').length + 1
      initSvgZoom(svgElement)
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
        const item = document.createElement('div')
        item.className = 'error-item'
        
        const msgEl = document.createElement('div')
        msgEl.className = 'message'
        msgEl.textContent = err.message
        item.appendChild(msgEl)

        if (err.selector) {
          item.addEventListener('click', (e) => {
            e.stopPropagation()
            
            // 1. Reset eerdere actieve rode gloeden in de SVG
            svgPreview.querySelectorAll('.neon-glow-active').forEach(el => {
              el.classList.remove('neon-glow-active')
            })

            // 2. Reset eerdere rode tekstkleuren in de Component Tree
            componentTree.querySelectorAll('.tree-error-active').forEach(el => {
              el.classList.remove('tree-error-active')
            })

            // 3. Zet de rode gloed aan op de SVG
            const targetEl = svgPreview.querySelector(err.selector)
            if (targetEl) {
              targetEl.classList.add('neon-glow-active')
            }

            // 4. SLIMME SELECTOR LOOKUP: Zoekt de exacte match óf de fallback (zoals een defs/style tag)
            let treeTarget = componentTree.querySelector(`[data-selector="${err.selector}"]`);
            
            // Fallback: Als de server een complexe 'use[href="..."]' selector stuurt, zoeken we naar het symbool in defs
            if (!treeTarget && err.selector.includes('use[')) {
              treeTarget = componentTree.querySelector(`[data-selector="svg > defs"]`);
            }

            if (treeTarget) {
              treeTarget.classList.add('tree-error-active')
              
              // Klap automatisch alle mappen naar boven toe open
              let parent = treeTarget.parentElement
              while (parent && parent !== componentTree) {
                if (parent.tagName === 'DETAILS') {
                  parent.open = true
                }
                parent = parent.parentElement
              }
              
              // Scroll de boomstructuur soepel naar de fout toe
              treeTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            }
          })
        }
        errorList.appendChild(item)
      })
    }
  }

  // Geavanceerde Zoom & Pan (Slepen) functionaliteit
  function initSvgZoom(svgElement) {
    let scale = 1
    let translateX = 0
    let translateY = 0
    
    let isDragging = false
    let startX = 0
    let startY = 0

    const MIN_SCALE = 0.4
    const MAX_SCALE = 6
    const ZOOM_SPEED = 0.12

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

    svgElement.style.transformOrigin = 'center center'
    updateTransform()

    function updateTransform() {
      svgElement.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`
    }

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

    document.getElementById('newSvgBtn').addEventListener('click', (e) => {
      e.stopPropagation()
      
      svgPreview.innerHTML = ''
      svgPreview.style.display = 'none'
      prompt.style.display = 'flex'
      fileInput.value = ''
      dropZone.classList.remove('has-svg')
      componentTree.innerHTML = '<span class="tree-placeholder">Upload een SVG om de componenten boom te bekijken...</span>'
      errorList.innerHTML = ''
      statusBadge.textContent = 'Wachten op SVG bestand...'
      appContainer.className = 'app-container'
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