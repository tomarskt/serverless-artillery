/**
 * @module integrity-check
 */

const UP_TO_DATE = 0
const CAN_UPDATE = 1
const CONFLICT = 2

/**
 * Instantiates an integrity-checker capable of validating the integrity (i.e. unchanged
 * since unpacking, e.g. via 'configure' command) of Serverless Artillery lambda assets.
 *
 * This module refers to unpacked user SA lambda assets as `localAssets` and those contained
 * in the currently running SA installation as `defaultAssets`.
 *
 * @param {Object} fs - Node JS file module
 * @param {Object} path - Node JS path module
 * @param {Object} yaml - YAML reader/writer
 * @param {function(string, Object)} hashElement - Recursive hashing of files under a path
 * @param {function(string, string)} cmp - Compares semantic versions
 * @returns {
 *   {
 *     calculateIntegrityHash: (function(string)),
 *     readAssetSemVer: (function(*=)),
 *     updateIntegrityFile: (function(*=)),
 *     UP_TO_DATE: number,
 *     CAN_UPDATE: number,
 *     CONFLICT: number,
 *     checkAssets: (function(*=))
 *   }
 * }
 */
module.exports = (fs, path, yaml, hashElement, cmp) => {
  const impl = {
    /**
     * Calculates the hash value for the current assets contents.
     * @param {string} assetsPath - path to a lambda worker project
     * @returns {string} - hash value of assets
     */
    calculateIntegrityHash: assetsPath => hashElement(assetsPath, {
      folders: { exclude: ['.serverless', 'node_modules'] },
      files: { include: ['*.js', 'package.json'] },
    }).then(hash => hash.hash),

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

    /**
     * Checks the local assets integrity against default assets.
     * Returns Promise which resolves to one of:
     *   UP_TO_DATE - local assets are up to date with default assets
     *   CAN_UPDATE - local assets are unmodified and can be updated
     *   CONFLICT - local assets have been modified
     * @param localPath - path to root of local SA project
     */
    checkAssets: (localPath) => {
      const defaultAssetsPath = path.join(__dirname, 'lambda')
      const defaultVersion = impl.readAssetSemVer(defaultAssetsPath)
      const localVersion = impl.readAssetSemVer(localPath)

      const versionCompare = cmp(defaultVersion, localVersion)

      // Versions are the same
      if (versionCompare === 0) {
        return Promise.resolve(UP_TO_DATE)
      }

      return impl.calculateIntegrityHash(localPath)
        .then((localHash) => {
          const integrityPath = path.join(localPath, '.integrity.yml')
          const integrity = yaml.safeLoad(fs.readFileSync(integrityPath))

          // Default version newer & local assets are unmodified
          if (versionCompare === 1 && integrity.hash === localHash) {
            return CAN_UPDATE
          }

          return CONFLICT
        })
    },
  }

  return impl
}

module.exports.UP_TO_DATE = UP_TO_DATE
module.exports.CAN_UPDATE = CAN_UPDATE
module.exports.CONFLICT = CONFLICT
