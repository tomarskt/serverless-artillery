/**
 * @module assets-version
 */

const SAME_VERSION = 0
const OLDER_VERSION = 1
const NEWER_VERSION = 2

/**
 * Instantiates the assets-version module which is used to manage various considerations
 * related to serverless assets deployed to the FAAS provider.
 *
 * This module refers to unpacked user SA lambda assets as `localAssets` and those contained
 * in the currently running SA installation as `defaultAssets`.
 *
 * @param {Object} fs - Node JS file module
 * @param {Object} path - Node JS path module
 * @param {function(string, string)} cmp - Compares semantic versions
 * @returns {
 *   {
 *     readAssetSemVer: (function(*=)),
 *     checkLocalAssetVersion: (function(string)),
 *   }
 * }
 */
module.exports = (fs, path, cmp) => {
  const impl = {
    /**
     * Reads the version property from the asset's project.json file.
     * Defaults to 0.0.0 if version property not found.
     * @param assetsPath - path to a lambda worker project
     * @return {string} - version property read from package.json
     */
    readAssetSemVer: (assetsPath) => {
      try {
        // Default to 0.0.0 for legacy assets which do not include an explicit version.
        return JSON.parse(fs.readFileSync(path.join(assetsPath, 'package.json'))).version || '0.0.0'
      } catch (ex) {
        throw new Error(`Failed to read package.json or parse its contents for assets in ${assetsPath}: ${ex}`)
      }
    },

    /**
     * Compares the local assets version to the default assets version.
     * Returns one of:
     *   SAME_VERSION - local and default assets are the same version
     *   OLDER_VERSION - local assets are older than the default assets
     *   NEWER_VERSION - local assets are newer than the default assets
     * @param localPath - path to root of local SA project
     * @returns {number} - one of the enumerated values mentioned above
     */
    checkLocalAssetVersion: (localPath) => {
      const defaultAssetsPath = path.join(__dirname, 'lambda')
      const defaultVersion = impl.readAssetSemVer(defaultAssetsPath)
      const localVersion = impl.readAssetSemVer(localPath)

      const versionCompare = cmp(localVersion, defaultVersion)

      switch (versionCompare) {
        case -1: return NEWER_VERSION
        case 0: return SAME_VERSION
        case 1: return OLDER_VERSION
        default: throw new Error('Unexpected SemVer comparison result!')
      }
    },
  }

  return impl
}

module.exports.SAME_VERSION = SAME_VERSION
module.exports.OLDER_VERSION = OLDER_VERSION
module.exports.NEWER_VERSION = NEWER_VERSION
