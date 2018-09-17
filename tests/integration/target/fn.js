const curry = (fn, arity) =>
  (arity > -1
    ? (...args) =>
      (args.length >= arity
        ? fn(...args)
        : curry(fn.bind(null, ...args), arity - args.length))
    : curry(fn, fn.length))

const memoize = (fn, arity) => {
  const cache = {}
  const serialize = value =>
    (typeof value === 'function'
      ? value.toString()
      : JSON.stringify(value))
  return curry(
    (...args) =>
      (key => (cache.hasOwnProperty(key)
        ? cache[key]
        : (cache[key] = fn(...args))))(serialize(args)),
    arity || fn.length
  )
}

const flatten = values =>
  values.reduce((flattened, value) =>
    (Array.isArray(value)
      ? flattened.concat(flatten(value))
      : flattened.concat([value])), [])

const isThennable = value =>
  value && value.then && (typeof value.then === 'function')

const catchSymbol = Symbol('catch')

const pipe = (...steps) =>
  initialValue =>
    flatten(steps).reduce((value, step) => (step
      ? isThennable(value)
        ? step[catchSymbol]
          ? value.catch(step)
          : value.then(step)
        : step(value)
      : value), initialValue)

pipe.catch = (handler) =>
  handler[catchSymbol] = true && handler

const tap = next => value => {
  next(value)
  return value
}

module.exports = {
  flatten,
  curry,
  memoize,
  pipe,
  tap,
}
