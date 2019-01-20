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
  //parsePath返回一个函数
const bailRE = /[^\w.$]/
export function parsePath (path: string): any {
  if (bailRE.test(path)) {
    return
  }
  const segments = path.split('.')
  // 如果是user watcher，在this.get()的时候会传入vm，返回这个监听的属性在这个vue实例上的值
  return function (obj) {
    for (let i = 0; i < segments.length; i++) {
      if (!obj) return
      //这里会触发getter函数(即vm[key])，即收集依赖，订阅这个user watcher
      // 同时返回观察的属性在vm实例上的值（在watch上定义的属性必须存在与vm实例中才能被观测）
      obj = obj[segments[i]]
    }
    return obj
  }
}
