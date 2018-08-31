const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const { hashElement } = require('folder-hash')

const integrity = require('./lib/integrity-check.js')(fs, path, yaml, hashElement)

console.log('Generating updated integrity hash ...')

integrity.updateIntegrityFile(__dirname)
  .then(() => console.log('Done.'))
