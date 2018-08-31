module.exports = (fs, path, yaml, hashElement) => {
  const impl = {
    /**
     * Calculates the hash value for the current assets contents.
     * @param assetsPath - path to a lambda worker project
     */
    calculateIntegrityHash: (assetsPath) => {
      return hashElement(assetsPath, {
        folders: { exclude: ['.serverless', 'node_modules'] },
        files: { include: ['*.js', 'package.json'] },
      })
        .then(hash => hash.hash)
    },

    /**
     * Reads the version property from the asset's project.json file.
     * @param assetsPath - path to a lambda worker project
     */
    readAssetSemVer: (assetsPath) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(assetsPath, 'package.json'))).version
      } catch (ex) {
        throw new Error(`Failed to read package.json or parse its contents for assets in ${assetsPath}: ${ex}`)
      }
    },

    /**
     * Generates an integrity hash for the current lambda worker
     * project version and updates the .integrity.yml file.
     * @param projectPath - path to root of SA project
     */
    updateIntegrityFile: (projectPath) => {
      const assetsPath = path.join(projectPath, 'lib', 'lambda')
      const integrityPath = path.join(assetsPath, '.integrity.yml')

      return impl.calculateIntegrityHash(assetsPath)
        .then(hash => ({
          hash,
          semver: impl.readAssetSemVer(assetsPath),
        }))
        .then((integrity) => {
          try {
            fs.writeFileSync(integrityPath, yaml.dump(integrity))
          } catch (ex) {
            throw new Error(`Failed to write integrity file at ${integrityPath}: ${ex}`)
          }
        })
    },

    UP_TO_DATE: 0,
    CAN_UPDATE: 1,
    CONFLICT: 2,

    /**
     * Checks the local assets integrity against default assets.
     * Returns one of:
     *   UP_TO_DATE - local assets are up to date with default assets
     *   CAN_UPDATE - local assets are unmodified and can be updated
     *   CONFLICT - local assets have been modified
     * @param projectPath - path to root of SA project
     */
    checkProjectIntegrity: (projectPath) => {
      // TODO ...
    },
  }

  return impl
}
