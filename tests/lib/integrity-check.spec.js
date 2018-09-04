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

    const cmpDefault = () => 0

    const createHarness = ({
      fs = fsDefault,
      path = pathDefault,
      hashElement = hashElementDefault,
      cmp = cmpDefault,
    }) => integrity(fs, path, yaml, hashElement, cmp)

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
      it('writes update to ./lib/lambda/.integirty.yml', () =>
        expect(createHarness({
          fs: Object.assign(fsDefault, {
            readFileSync: () => JSON.stringify({ version: '0.0.0' }),
            writeFileSync: path => expect(path).to.equal('./lib/lambda/.integrity.yml'),
          }),
        }).updateIntegrityFile('.')).be.fulfilled
      )

      it('writes version to integrity file', () =>
        expect(createHarness({
          fs: Object.assign(fsDefault, {
            readFileSync: () => JSON.stringify({ version: '0.0.0' }),
            writeFileSync: (path, contents) => expect(yaml.safeLoad(contents).semver).to.equal('0.0.0'),
          }),
        }).updateIntegrityFile('.')).be.fulfilled
      )

      it('writes hash to integrity file', () =>
        expect(createHarness({
          fs: Object.assign(fsDefault, {
            readFileSync: () => JSON.stringify({ version: '0.0.0' }),
            writeFileSync: (path, contents) => expect(yaml.safeLoad(contents).hash).to.equal('HASH'),
          }),
        }).updateIntegrityFile('.')).be.fulfilled
      )

      it('throws an error if write fails', () =>
        expect(createHarness({
          fs: Object.assign(fsDefault, {
            readFileSync: () => JSON.stringify({ version: '0.0.0' }),
            writeFileSync: () => { throw new Error('FAIL!') },
          }),
        }).updateIntegrityFile('.')).be.rejectedWith(/Failed to write integrity file/)
      )

      it('throws an error including the integrity file path', () =>
        expect(createHarness({
          fs: Object.assign(fsDefault, {
            readFileSync: () => JSON.stringify({ version: '0.0.0' }),
            writeFileSync: () => { throw new Error('FAIL!') },
          }),
        }).updateIntegrityFile('.')).be.rejectedWith(/\.\/lib\/lambda\/\.integrity\.yml/)
      )

      it('throws an error including the original error', () =>
        expect(createHarness({
          fs: Object.assign(fsDefault, {
            readFileSync: () => JSON.stringify({ version: '0.0.0' }),
            writeFileSync: () => { throw new Error('FAIL!') },
          }),
        }).updateIntegrityFile('.')).be.rejectedWith(/FAIL!/)
      )
    })

    describe('#checkAssets', () => {
      it('returns UP_TO_DATE if default and local asset versions match', () =>
        expect(createHarness({
          cmp: () => 0,
        }).checkAssets('.')).to.eventually.equal(integrity.UP_TO_DATE)
      )

      it('returns CAN_UPDATE if default assets version is newer and hash matches', () =>
        expect(createHarness({
          fs: Object.assign(fsDefault, {
            readFileSync: () => JSON.stringify({ hash: 'HASH' }),
          }),
          cmp: () => 1,
        }).checkAssets('.')).to.eventually.equal(integrity.CAN_UPDATE)
      )

      it('returns CONFLICT if default asset version is older', () =>
        expect(createHarness({
          fs: Object.assign(fsDefault, {
            readFileSync: () => JSON.stringify({ hash: 'HASH' }),
          }),
          cmp: () => -1,
        }).checkAssets('.')).to.eventually.equal(integrity.CONFLICT)
      )

      it('returns CONFLICT if default assets version is newer but hashes differ', () =>
        expect(createHarness({
          fs: Object.assign(fsDefault, {
            readFileSync: () => JSON.stringify({ hash: 'XXXX' }),
          }),
          cmp: () => 1,
        }).checkAssets('.')).to.eventually.equal(integrity.CONFLICT)
      )
    })
  })
})
