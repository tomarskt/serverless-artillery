const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')

chai.use(chaiAsPromised)

const { expect } = chai

const assetsVersion = require('../../lib/assets-version')

describe('./lib/assets-version.js', function slsArtTests() { // eslint-disable-line prefer-arrow-callback
  describe(':impl', () => {
    const pathDefault = {
      join: (...parts) => parts.join('/'),
    }

    const fsDefault = {
      readFileSync: () => JSON.stringify({}),
    }

    const semverDefault = {
      lt: () => false,
      gt: () => false,
    }

    const createHarness = ({
      fs = fsDefault,
      path = pathDefault,
      semver = semverDefault,
    }) => assetsVersion(fs, path, semver)

    describe('#readAssetVersion', () => {
      it('reads the version property', () => {
        expect(createHarness({
          fs: {
            readFileSync: () => JSON.stringify({ version: '0.0.1' }),
          },
        }).readAssetVersion('.')).to.equal('0.0.1')
      })

      it('defaults to 0.0.0 if version property not set', () => {
        expect(createHarness({
          fs: {
            readFileSync: () => JSON.stringify({}),
          },
        }).readAssetVersion('.')).to.equal('0.0.0')
      })

      it('reads from the package.json', () => {
        expect(createHarness({
          fs: {
            readFileSync: (path) => {
              expect(path).to.equal('./package.json')
              return JSON.stringify({ version: '0.0.0' })
            },
          },
        }).readAssetVersion('.'))
      })

      it('throws an error if read fails', () => {
        expect(() => createHarness({
          fs: {
            readFileSync: () => {
              throw new Error('FAIL!')
            },
          },
        }).readAssetVersion('.')).to.throw(/Failed to read package.json/)
      })

      it('throws an error if parse fails', () => {
        expect(() => createHarness({
          fs: {
            readFileSync: () => '{ not.JSON;;;',
          },
        }).readAssetVersion('.')).to.throw(/or parse its contents/)
      })

      it('throws an error containing asset path', () => {
        expect(() => createHarness({
          fs: {
            readFileSync: () => '{ not.JSON;;;',
          },
        }).readAssetVersion('/path/to/assets')).to.throw(/for assets in \/path\/to\/assets/)
      })

      it('throws an error containing original error message', () => {
        expect(() => createHarness({
          fs: {
            readFileSync: () => {
              throw new Error('FAIL!')
            },
          },
        }).readAssetVersion('.')).to.throw(/FAIL!/)
      })
    })

    describe('#localAssetVersion', () => {
      it('reads the version property via readAssetVersion', () => {
        expect(createHarness({
          fs: {
            readFileSync: () => JSON.stringify({ version: '0.0.1' }),
          },
        }).localAssetVersion('.')).to.equal('0.0.1')
      })
    })

    describe('#defaultAssetVersion', () => {
      it('reads the default version property via readAssetVersion', () => {
        expect(createHarness({
          fs: {
            readFileSync: () => JSON.stringify({ version: '0.0.1' }),
          },
        }).defaultAssetVersion()).to.equal('0.0.1')
      })
    })

    describe('#checkLocalAssetVersion', () => {
      it('returns SAME_VERSION if default and local asset versions match', () =>
        expect(createHarness({
          semver: {
            lt: () => false,
            gt: () => false,
          },
        }).checkLocalAssetVersion('.')).to.equal(assetsVersion.SAME_VERSION)
      )

      it('returns NEWER_VERSION if local assets version is newer than default assets version', () =>
        expect(createHarness({
          semver: {
            lt: () => true,
            gt: () => false,
          },
        }).checkLocalAssetVersion('.')).to.equal(assetsVersion.NEWER_VERSION)
      )

      it('returns OLDER_VERSION if local assets version is newer than default assets version', () =>
        expect(createHarness({
          semver: {
            lt: () => false,
            gt: () => true,
          },
        }).checkLocalAssetVersion('.')).to.equal(assetsVersion.OLDER_VERSION)
      )
    })
  })
})
