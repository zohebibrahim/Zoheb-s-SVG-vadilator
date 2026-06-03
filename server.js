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
      error: () => {}, // Negeer milde XML waarschuwingen voor een soepelere ervaring
      fatalError: (msg) => errors.push({ message: `XML Structuur Fout: ${msg}` })
    }
  })

  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  if (errors.length > 0) return { valid: false, errors }

  const root = doc.documentElement
  
  // US-02: Hoofdtag controle
  if (!root || root.tagName !== 'svg') {
    errors.push({ message: 'Het bestand is geen geldige SVG (hoofdtag mist).', selector: 'svg' })
    return { valid: false, errors }
  }

  // US-02: Klasse "installation" aanwezigheid
  if (root.getAttribute('class') !== 'installation') {
    errors.push({ message: `De hoofd <svg> tag mist de verplichte klasse "installation".${getLine(root)}`, selector: 'svg' })
  }

  // US-02: Controleer of <style>, <defs> en <g> AANWEZIG zijn direct onder de root
  const rootChildren = Array.from(root.childNodes).filter(n => n.nodeType === 1)
  const styleNode = rootChildren.find(n => n.tagName === 'style')
  const defsNode = rootChildren.find(n => n.tagName === 'defs')
  const mainGNode = rootChildren.find(n => n.tagName === 'g' && n.getAttribute('class') !== 'click-area')

  if (!styleNode) errors.push({ message: 'Verplichte tag <style> ontbreekt direct onder de root.', selector: 'svg' })
  if (!defsNode) errors.push({ message: 'Verplichte tag <defs> ontbreekt direct onder de root.', selector: 'svg' })
  if (!mainGNode) errors.push({ message: 'Verplichte hoofdgroep <g> ontbreekt direct onder de root.', selector: 'svg' })

  const definedSymbolIds = []
  const definedCssClasses = new Set()

  // CSS Parser: Verzamel gedefinieerde klassen uit <style>
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

  // --- DEFS & SYMBOL VALIDATIE ---
  if (defsNode) {
    const symbols = Array.from(defsNode.childNodes).filter(n => n.nodeType === 1 && n.tagName === 'symbol')
    
    symbols.forEach((symbol) => {
      const id = symbol.getAttribute('id')
      if (id) definedSymbolIds.push(id)

      const symbolChildren = Array.from(symbol.childNodes).filter(n => n.nodeType === 1)
      
      // Check: bevat <g class="installation_section">
      const hasInstSection = symbolChildren.some(n => n.tagName === 'g' && n.getAttribute('class') === 'installation_section')
      if (!hasInstSection) {
        errors.push({ 
          message: `Symbool "${id || 'onbekend'}" moet een <g> groep bevatten met de klasse "installation_section".`, 
          selector: id ? `svg > g > use[href="#${id}"], use[*|href="#${id}"]` : 'defs'
        })
      }

      // Check: bevat de transparante click-area ergens binnen het symbool
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
