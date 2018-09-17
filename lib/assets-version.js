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
 * @param {Object} semver - NPM semver package
 * @returns {
 *   {
 *     readAssetVersion: (function(string)),
 *     localAssetVersion: (function(string)),
 *     defaultAssetVersion: (function()),
 *     checkLocalAssetVersion: (function(string)),
 *   }
 * }
 */
module.exports = (fs, path, semver) => {
  const impl = {
    /**
     * Reads the version property from the asset's project.json file.
     * Defaults to 0.0.0 if version property not found.
     * @param assetsPath - path to a function project assets
     * @return {string} - version property read from package.json
     */
    readAssetVersion: (assetsPath) => {
      try {
        // Default to 0.0.0 for legacy assets which do not include an explicit version.
        const packagePath = path.join(assetsPath, 'package.json')
        const packageString = fs.readFileSync(packagePath)
        return JSON.parse(packageString).version || '0.0.0'
      } catch (ex) {
        throw new Error(`Failed to read package.json or parse its contents for assets in ${assetsPath}: ${ex}`)
      }
    },

    /**
     * Given the path to a local assets project, return the version.
     * @param localPath - path to a function project assets
     * @return {string} - semantic version of the local assets
     */
    localAssetVersion: localPath => impl.readAssetVersion(localPath),

    /**
     * Version of the project's default assets.
     * @return {string} - semantic version of the default assets
     */
    defaultAssetVersion: () => impl.readAssetVersion(path.join(__dirname, 'lambda')),

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
      const defaultVersion = impl.defaultAssetVersion()
      const localVersion = impl.localAssetVersion(localPath)

      if (semver.gt(defaultVersion, localVersion)) {
        return OLDER_VERSION
      } else if (semver.lt(defaultVersion, localVersion)) {
        return NEWER_VERSION
      } else {
        return SAME_VERSION
      }
    },
  }

  return impl
}

module.exports.SAME_VERSION = SAME_VERSION
module.exports.OLDER_VERSION = OLDER_VERSION
module.exports.NEWER_VERSION = NEWER_VERSION
