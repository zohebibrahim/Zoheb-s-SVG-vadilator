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

