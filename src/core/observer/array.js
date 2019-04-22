/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
//修改了数组的原型方法,使得他能够更新视图
methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]
  def(arrayMethods, method, /*value的值,这里指修改后的原型方法*/function mutator (/*数组*/...args) {
    const result = original.apply(this, args)
    //获取__ob__内部属性,里面保存了dep属性
    const ob = this.__ob__
    //定义unshift/splice新增的元素
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    //将新增的数组元素变成响应式
    if (inserted) ob.observeArray(inserted)
    // notify change
    //手动更新视图
    ob.dep.notify()
    return result
  })
})
