const fs = require('fs')
const path = require('path')
const { hashElement } = require('folder-hash')

const lambdaPath = path.join(__dirname, 'lib', 'lambda')
const lambdaPackagePath = path.join(lambdaPath, 'package.json')
const lambdaPackage = fs.readFileSync(lambdaPackagePath, 'utf-8')
const lambdaPackageObject = JSON.parse(lambdaPackage)
const existingIntegrity = lambdaPackageObject._integrity // eslint-disable-line no-underscore-dangle

if (!existingIntegrity) {
  console.log('ERROR: No existing integrity hash found.')
  process.exit(1)
}

const options = {
  folders: { exclude: ['.serverless', 'node_modules'] },
  files: { include: ['*.js'] },
}

console.log(`Generating updated integrity hash for: ${lambdaPath} ...`)

hashElement(lambdaPath, options)
  .then((hash) => {
    const hashString = hash.hash
    fs.writeFileSync(lambdaPackagePath, lambdaPackage.replace(existingIntegrity, hashString))
    console.log(`Updated integrity hash: ${hashString}\nDONE.`)
  })
  .catch(error => console.error('hashing failed:', error))
