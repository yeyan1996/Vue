/* @flow */

import { _Set as Set, isObject } from '../util/index'
import type { SimpleSet } from '../util/index'
import VNode from '../vdom/vnode'

const seenObjects = new Set()

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
//被观测的属性值（一般为一个对象需要用到deep属性），做深度遍历，访问所有子属性进行依赖收集=>将所有属性中的dep实例的subs数组添加user watcher
export function traverse (val: any) {
  _traverse(val, seenObjects)
  seenObjects.clear()
}

function _traverse (val: any, seen: SimpleSet) {
  let i, keys
  const isA = Array.isArray(val)
  if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
    return
  }
  if (val.__ob__) {
    const depId = val.__ob__.dep.id
    if (seen.has(depId)) {
      return
    }
    seen.add(depId)
  }
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  } else {
    keys = Object.keys(val)
    i = keys.length
    //val[keys[i]]会触发这个key的getter从而收集user watcher这个依赖，递归调用会把这个对象所有的值为对象的属性的dep的subs中添加当前的user watcher
    while (i--) _traverse(val[keys[i]], seen)
  }
}
