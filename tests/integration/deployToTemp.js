const { tmpdir } = require('os')
const { join } = require('path')
const cp = require('child_process')

const { randomString } = require('./target/handler')
const { pipe, tap } = require('./target/fn')

const defaultRoot = join(tmpdir(), 'slsart-integration')
const defaultSeparator = '-'.repeat(process.stdout.columns)

const pure = {
  execAsync: (exec = cp.exec) =>
    (command, options = {}) =>
      new Promise((resolve, reject) =>
        exec(command, options, (err, stdout, stderr) =>
          (err
            ? reject(new Error(err.message + ' ' + stderr))
            : resolve(stdout)))),

  deployTarget: (
    source = join(__dirname, 'target'),
    instanceId = randomString(8),
    execAsync = pure.execAsync(),
    log = console.log,
    separator = defaultSeparator,
    root = defaultRoot
  ) =>
    ((execSource, execDestination, destination) =>
      pipe(
        () => log(`Staging target to ${destination}\n${separator}`),
        () => `mkdir -p ${destination}`, //  2> /dev/null
        tap(log),
        execSource,
        () => "find serverless.yml *.js ! -name '*.spec.js*'",
        tap(log),
        execSource,
        fileList => `cp ${fileList.split('\n').join(' \\\n')} ${destination}`,
        tap(log),
        execSource,
        () => `echo "instanceId: ${instanceId}" >> ${destination}/config.yml`,
        tap(log),
        execSource,
        () => `sls deploy`,
        tap(log),
        execDestination,
        tap(log),
        () => log(`\nDone staging target to ${destination}\n${separator}\n`),
        pipe.catch(err => log(err.stack))
      ))(
        command => execAsync(command, { cwd: source }),
        command => execAsync(command, { cwd: join(root, instanceId) }),
        join(root, instanceId)
      ),

  remove: (execAsync = pure.execAsync(), log = console.log) =>
    destination =>
      execAsync('ls', { cwd: destination })
        .then(list => list.includes('serverless.yml')
          ? execAsync('sls remove', { cwd: destination })
            .catch(err =>
              log('WARNING: unable to sls remove', destination, err.message) ||
              log('  The associated CFT stack may have to be removed by hand.'))
          : true)
        .then(() => execAsync(`rm -rf ${destination}`)),

  cleanupDeployments: (
    remove = pure.remove(),
    root = defaultRoot,
    log = console.log,
    separator = defaultSeparator,
    execAsync = pure.execAsync()
  ) => pipe(
    () => log(`Cleaning up temp deployments\n${separator}`),
    () => execAsync(`ls ${join(root, '*/')} -d1`).catch(() => ''),
    paths => paths
      .split('\n')
      .map(path => path.trim())
      .filter(path => !!path)
      .map(tap(path => log('removing', path)))
      .map(remove),
    removals => Promise.all(removals),
    () => log(`\nDone cleaning up temp deployments\n${separator}\n`),
    pipe.catch(err => log(err.stack))
  )
}

module.exports = {
  pure,
  deployTarget: pure.deployTarget(),
  remove: pure.remove(),
  cleanupDeployments: pure.cleanupDeployments(),
}
