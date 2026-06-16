const express = require('express')
const multer = require('multer')
const { DOMParser } = require('xmldom')
const css = require('css')

const app = express()
const upload = multer({ storage: multer.memoryStorage() })

app.use(express.static('public'))

function getLine (node) {
  return node.lineNumber ? ` (lijn ${node.lineNumber})` : ''
}

function validateSVG (svgString) {
  const errors = []
  const parser = new DOMParser({
    errorHandler: {
      error: () => {},
      fatalError: (msg) => errors.push({ message: `XML Structuur Fout: ${msg}` })
    }
  })

  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  if (errors.length > 0) return { valid: false, errors }

  const root = doc.documentElement
  
  if (!root || root.tagName !== 'svg') {
    errors.push({ message: 'Het bestand is geen geldige SVG (hoofdtag mist).', selector: 'svg' })
    return { valid: false, errors }
  }

  if (root.getAttribute('class') !== 'installation') {
    errors.push({ message: `De hoofd <svg> tag mist de verplichte klasse "installation".${getLine(root)}`, selector: 'svg' })
  }
  
  const rootChildren = Array.from(root.childNodes).filter(n => n.nodeType === 1)
  const styleNode = rootChildren.find(n => n.tagName === 'style')
  const defsNode = rootChildren.find(n => n.tagName === 'defs')
  const mainGNode = rootChildren.find(n => n.tagName === 'g' && n.getAttribute('class') !== 'click-area')

  if (!styleNode) errors.push({ message: 'Verplichte tag <style> ontbreekt direct onder de root.', selector: 'svg' })
  if (!defsNode) errors.push({ message: 'Verplichte tag <defs> ontbreekt direct onder de root.', selector: 'svg' })
  if (!mainGNode) errors.push({ message: 'Verplichte hoofdgroep <g> ontbreekt direct onder de root.', selector: 'svg' })

  const definedSymbolIds = []
  const definedCssClasses = new Set()

  if (styleNode) {
    try {
      const styleContent = styleNode.textContent || ''
      const ast = css.parse(styleContent)
      if (ast.stylesheet && ast.stylesheet.rules) {
        ast.stylesheet.rules.forEach(rule => {
          if (rule.selectors) {
            rule.selectors.forEach(sel => {
              const matches = sel.match(/\.([a-zA-Z0-9_-]+)/g)
              if (matches) {
                matches.forEach(m => definedCssClasses.add(m.replace('.', '')))
              }
            })
          }
        })
      }
    } catch (e) {
      errors.push({ message: 'De <style> tag bevat CSS die niet correct gelezen kan worden.', selector: 'style' })
    }
  }

  if (defsNode) {
    const symbols = Array.from(defsNode.childNodes).filter(n => n.nodeType === 1 && n.tagName === 'symbol')
    
    symbols.forEach((symbol) => {
      const id = symbol.getAttribute('id')
      if (id) definedSymbolIds.push(id)

      const symbolChildren = Array.from(symbol.childNodes).filter(n => n.nodeType === 1)
      const hasInstSection = symbolChildren.some(n => n.tagName === 'g' && n.getAttribute('class') === 'installation_section')
      if (!hasInstSection) {
        errors.push({ 
          message: `Symbool "${id || 'onbekend'}" moet een <g> groep bevatten met de klasse "installation_section".`, 
          selector: id ? `svg > g > use[href="#${id}"], use[*|href="#${id}"]` : 'defs'
        })
      }

      const allSymbolElements = Array.from(symbol.getElementsByTagName('*'))
      const hasClickArea = typeof allSymbolElements.find(el => 
        ['g', 'path', 'rect', 'circle'].includes(el.tagName) && 
        el.getAttribute('class') === 'click-area' && 
        (el.getAttribute('fill') === 'transparent' || el.getAttribute('opacity') === '0')
      ) !== 'undefined'

      if (!hasClickArea) {
        errors.push({ 
          message: `Symbool "${id || 'onbekend'}" mist een interactief element met klasse "click-area" en fill="transparent".`, 
          selector: id ? `svg > g > use[href="#${id}"], use[*|href="#${id}"]` : 'defs'
        })
      }
    })
  }

  if (mainGNode) {
    const mainGChildren = Array.from(mainGNode.childNodes).filter(n => n.nodeType === 1)
    
    mainGChildren.forEach((child, index) => {
      const selector = `svg > g > :nth-child(${index + 1})`
      
      if (!['use', 'text', 'g'].includes(child.tagName)) {
        errors.push({ message: `Tag '${child.tagName}' is niet toegestaan direct onder de hoofdgroep <g>. Verpak deze eventueel in een subgroep <g class="click-area">.${getLine(child)}`, selector })
        return
      }

      if (child.tagName === 'use') {
        const href = child.getAttribute('xlink:href') || child.getAttribute('href') || ''
        const targetId = href.replace('#', '')
        if (!href) {
          errors.push({ message: `<use> tag mist een verwijzing (href).${getLine(child)}`, selector })
        } else if (!definedSymbolIds.includes(targetId)) {
          errors.push({ message: `<use> verwijst naar '#${targetId}', maar dit ID bestaat niet in de <defs>.${getLine(child)}`, selector })
        }
      }

      if (child.tagName === 'text') {
        if (!child.getAttribute('style')) {
          errors.push({ message: `<text> tag mist een 'style' attribuut.${getLine(child)}`, selector })
        }
        const tspan = Array.from(child.childNodes).find(n => n.tagName === 'tspan')
        if (!tspan) {
          errors.push({ message: `<text> tag moet een <tspan> subtag bevatten.${getLine(child)}`, selector })
        }
      }

      if (child.tagName === 'g') {
        if (child.getAttribute('class') !== 'click-area') {
          errors.push({ message: `Sub-groep <g> onder de hoofdgroep moet de klasse "click-area" bevatten.${getLine(child)}`, selector })
        }
      }

      const classes = Array.from(child.classList || [])
      classes.forEach(className => {
        if (!definedCssClasses.has(className) && className !== 'click-area' && className !== 'installation_section') {
          errors.push({
            message: `Klasse "${className}" is gebruikt maar ontbreekt in de <style> tag.`,
            selector
          })
        }
      })
    })
  }

  return { valid: errors.length === 0, errors }
}

app.post('/api/validate', upload.single('svgfile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ valid: false, errors: [{ message: 'Geen bestand gevonden.' }] })
  }
  const svgString = req.file.buffer.toString('utf8')
  const result = validateSVG(svgString)
  res.json({ ...result, svgRaw: svgString })
})

// server runt op localhost 3000
const PORT = 3000
app.listen(PORT, () => console.log(`Server draait op http://localhost:${PORT}`))