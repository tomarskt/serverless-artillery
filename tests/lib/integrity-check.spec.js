const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const yaml = require('js-yaml')

chai.use(chaiAsPromised)

const { expect } = chai

const integrity = require('../../lib/integrity-check')

describe('./lib/integrity-check.js', function slsArtTests() { // eslint-disable-line prefer-arrow-callback
  describe(':impl', () => {
    const fsDefault = {
      writeFileSync: () => {},
    }

    const pathDefault = {
      join: (...parts) => parts.join('/'),
    }

    const hashElementDefault = () => Promise.resolve({ hash: 'HASH' })

    const createHarness = ({
      fs = fsDefault,
      path = pathDefault,
      hashElement = hashElementDefault,
    }) => integrity(fs, path, yaml, hashElement)

    describe('#calculateIntegrityHash', () => {
      it('returns a hash value calculated via hashElement', () => {
        expect(createHarness({}).calculateIntegrityHash('.')).to.eventually.equal('HASH')
      })

      it('excludes .serverless and node_modules directories', () => {
        expect(createHarness({
          hashElement: (path, options) => {
            expect(options.folders.exclude.length).to.equal(2)
            expect(options.folders.exclude).to.contain('.serverless')
            expect(options.folders.exclude).to.contain('node_modules')
            return Promise.resolve({ hash: 'HASH' })
          },
        }).calculateIntegrityHash('.'))
      })

      it('includes files *.js and package.json', () => {
        expect(createHarness({
          hashElement: (path, options) => {
            expect(options.files.include.length).to.equal(2)
            expect(options.files.include).to.contain('*.js')
            expect(options.files.include).to.contain('package.json')
            return Promise.resolve({ hash: 'HASH' })
          },
        }).calculateIntegrityHash('.'))
      })
    })

    describe('#readAssetSemVer', () => {
      it('reads the version property', () => {
        expect(createHarness({
          fs: Object.assign(fsDefault, {
            readFileSync: () => JSON.stringify({ version: '0.0.0' }),
          }),
        }).readAssetSemVer('.')).to.equal('0.0.0')
      })

      it('reads from the package.json', () => {
        expect(createHarness({
          fs: Object.assign(fsDefault, {
            readFileSync: (path) => {
              expect(path).to.equal('./package.json')
              return JSON.stringify({ version: '0.0.0' })
            },
          }),
        }).readAssetSemVer('.'))
      })

      it('throws an error if read fails', () => {
        expect(() => createHarness({
          fs: Object.assign(fsDefault, {
            readFileSync: () => {
              throw new Error('FAIL!')
            },
          }),
        }).readAssetSemVer('.')).to.throw(/Failed to read package.json/)
      })

      it('throws an error if parse fails', () => {
        expect(() => createHarness({
          fs: Object.assign(fsDefault, {
            readFileSync: () => '{ not.JSON;;;',
          }),
        }).readAssetSemVer('.')).to.throw(/or parse its contents/)
      })

      it('throws an error containing asset path', () => {
        expect(() => createHarness({
          fs: Object.assign(fsDefault, {
            readFileSync: () => '{ not.JSON;;;',
          }),
        }).readAssetSemVer('/path/to/assets')).to.throw(/for assets in \/path\/to\/assets/)
      })

      it('throws an error containing original error message', () => {
        expect(() => createHarness({
          fs: Object.assign(fsDefault, {
            readFileSync: () => {
              throw new Error('FAIL!')
            },
          }),
        }).readAssetSemVer('.')).to.throw(/FAIL!/)
      })
    })

    describe('#updateIntegrityFile', () => {
      it('writes update to ./lib/lambda/.integirty.yml', () => {
        return expect(createHarness({
          fs: Object.assign(fsDefault, {
            readFileSync: () => JSON.stringify({ version: '0.0.0' }),
            writeFileSync: path => expect(path).to.equal('./lib/lambda/.integrity.yml'),
          }),
        }).updateIntegrityFile('.')).be.fulfilled
      })

      it('writes version to integrity file', () => {
        return expect(createHarness({
          fs: Object.assign(fsDefault, {
            readFileSync: () => JSON.stringify({ version: '0.0.0' }),
            writeFileSync: (path, contents) => expect(yaml.safeLoad(contents).semver).to.equal('0.0.0'),
          }),
        }).updateIntegrityFile('.')).be.fulfilled
      })

      it('writes hash to integrity file', () => {
        return expect(createHarness({
          fs: Object.assign(fsDefault, {
            readFileSync: () => JSON.stringify({ version: '0.0.0' }),
            writeFileSync: (path, contents) => expect(yaml.safeLoad(contents).hash).to.equal('HASH'),
          }),
        }).updateIntegrityFile('.')).be.fulfilled
      })

      it('throws an error if write fails', () => {
        return expect(createHarness({
          fs: Object.assign(fsDefault, {
            readFileSync: () => JSON.stringify({ version: '0.0.0' }),
            writeFileSync: () => { throw new Error('FAIL!')},
          }),
        }).updateIntegrityFile('.')).be.rejectedWith(/Failed to write integrity file/)
      })

      it('throws an error including the integrity file path', () => {
        return expect(createHarness({
          fs: Object.assign(fsDefault, {
            readFileSync: () => JSON.stringify({ version: '0.0.0' }),
            writeFileSync: () => { throw new Error('FAIL!')},
          }),
        }).updateIntegrityFile('.')).be.rejectedWith(/\.\/lib\/lambda\/\.integrity\.yml/)
      })

      it('throws an error including the original error', () => {
        return expect(createHarness({
          fs: Object.assign(fsDefault, {
            readFileSync: () => JSON.stringify({ version: '0.0.0' }),
            writeFileSync: () => { throw new Error('FAIL!')},
          }),
        }).updateIntegrityFile('.')).be.rejectedWith(/FAIL!/)
      })
    })
  })
})
