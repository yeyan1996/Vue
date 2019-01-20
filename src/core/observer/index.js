/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
//value满足（127）的定义才会实例化一个observer
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  constructor (value: any) {
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0
    //def是Object.defineProperty的封装，第三个参数为value的值，默认为内部属性不可枚举
    //这里给传入class的参数（一个需要被观测的数组/对象）定义一个__ob__属性，值是这个Observer的实例
    def(value, '__ob__', this)
    if (Array.isArray(value)) {
      if (hasProto) {
        protoAugment(value, arrayMethods)
      } else {
        //拷贝一个数组的原型(一般用不到)
        copyAugment(value, arrayMethods, arrayKeys)
      }
      //递归遍历数组将数组的所有元素执行observe方法（将数组内的所有数组/对象元素添加__ob__内部属性）
      this.observeArray(value)
    } else {
      //value为一个对象
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  //将对象和它拥有的每个可枚举的属性（不包括__ob__）作为参数传入defineReactive方法
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      //将对象自身和它的属性传入defineReactive执行数据劫持
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  //观察的对象必须是对象，不能是一个vnode
  if (!isObject(value) || value instanceof VNode) {
    //直接返回Undefined
    return
  }
  let ob: Observer | void
  //如果已经被观察了就直接返回
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    //满足下列所有条件才能生成一个Observer的实例
    shouldObserve && //是否需要被观测，类似全局开关，通过toggleObserving（src/core/observer/index.js:27）可以改变
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) && //数组/普通对象
    Object.isExtensible(value) && //必须是可扩展的
    !value._isVue //不能是Vue
  ) {
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */
//定义一个响应式对象（reactive中文=>响应）
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  /**在定义的时候就给这个对象的所有键一个dep的实例**/
  const dep = new Dep()

  const property = Object.getOwnPropertyDescriptor(obj, key)
  //不可配置的属性直接返回
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  const getter = property && property.get
  const setter = property && property.set
  //如果没有原生的getter,setter，获取这个对象属性的值
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }
  //给data/props中的每个属性定义了getter/setter(此时未调用)
  //如果这个对象的属性值是对象就递归调用,到达底部的时候childOb为undefined,随后到从子再到父级会返回一个内部的ob对象
  //即childOb存在时,当前键的值是一个对象/数组
  //observe观察(val)的必须是一个对象/数组
  let childOb = !shallow && observe(val)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    //真正调用get的时候是执行用户定义/模板编译的render函数(依赖收集)
    get: function reactiveGetter () {
      //val可以是对象也可以是基本数据类型
      const value = getter ? getter.call(obj) : val
      if (Dep.target) {
        //给这个dep实例的subs属性添加Dep.target这个watcher，同时给当前栈顶的Dep.target（watcher）的deps添加这个dep实例
        dep.depend()
        if (childOb) { //非 递归的最底层的逻辑(用于Vue.set?)
          //给作为对象的子属性值的内部属性__ob__进行收集依赖
          childOb.dep.depend()
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      childOb = !shallow && observe(newVal)
      //派发更新
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
//定义Vue.set方法
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  //是否为合法Array
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  //是否已经存在这个key
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  //避免是Vue和一个根的data属性
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  //将对象新增的key变成一个响应式对象
  defineReactive(ob.value, key, val)
  //这里能拿到ob对象因为在(82)定义了childOb并且收集了依赖
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
