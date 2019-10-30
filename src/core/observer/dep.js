/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'
import config from '../config'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
// 建立数据和watcher之间的桥梁
// 每个响应式变量内部会保存一个 dep 实例
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  constructor () {
    this.id = uid++
    //保存watcher实例的数组
    this.subs = []
  }

  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }
  //给这个dep实例的subs属性添加Dep.target这个watcher，同时给watcher的deps添加这个dep实例
  //可以理解为给当前dep实例收集了一个栈顶的watcher，即Dep.target
  depend () {
    if (Dep.target) {
      //Dep.target是一个watcher
      // 给当前 dep 实例，添加栈顶的 watcher
      Dep.target.addDep(this)
    }
  }
  // 遍历当前dep实例的subs属性执行update方法
  notify () {
    // stabilize the subscriber list first
    const subs = this.subs.slice()
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      subs.sort((a, b) => a.id - b.id)
    }
    for (let i = 0, l = subs.length; i < l; i++) {
      //给每个watcher实例执行update方法
      subs[i].update()
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
Dep.target = null
const targetStack = []

export function pushTarget (target: ?Watcher) {
  targetStack.push(target)
  Dep.target = target
}

export function popTarget () {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}
