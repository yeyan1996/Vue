/* @flow */

/**
 * Check if a string starts with $ or _
 */
export function isReserved (str: string): boolean {
  const c = (str + '').charCodeAt(0)
  return c === 0x24 || c === 0x5F
}

/**
 * Define a property.
 */
export function def (obj: Object, key: string, val: any, enumerable?: boolean) {
  Object.defineProperty(obj, key, {
    value: val,
    enumerable: !!enumerable,
    writable: true,
    configurable: true
  })
}

/**
 * Parse simple path.
 */
  //parsePath传入一个字符串,表示监听的字符串("a.b.c")
const bailRE = /[^\w.$]/
export function parsePath (path: string): any {
  if (bailRE.test(path)) {
    return
  }
  const segments = path.split('.')
  // 返回一个函数
  // 如果是user watcher，在this.get()的时候会传入vm作为obj参数，返回这个监听的属性在这个vue实例上的值
  // 将"a.b.c"转换为["a","b","c"],并且反复求值
  return function (obj) {
    for (let i = 0; i < segments.length; i++) {
      if (!obj) return

      // 这里会同时触发getter函数(即vm[key])，收集依赖，订阅这个user watcher
      // 返回最终这个字符串在当前vm实例对应的值
      obj = obj[segments[i]]
    }
    return obj
  }
}
