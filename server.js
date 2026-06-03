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
  