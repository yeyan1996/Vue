/* @flow */

import type Watcher from './watcher'
import config from '../config'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import {
  warn,
  nextTick,
  devtools
} from '../util/index'

export const MAX_UPDATE_COUNT = 100

const queue: Array<Watcher> = []
const activatedChildren: Array<Component> = []
let has: { [key: number]: ?true } = {}
let circular: { [key: number]: number } = {}
let waiting = false
let flushing = false
let index = 0

/**
 * Reset the scheduler's state.
 */
function resetSchedulerState () {
  index = queue.length = activatedChildren.length = 0
  has = {}
  if (process.env.NODE_ENV !== 'production') {
    circular = {}
  }
  waiting = flushing = false
}

/**
 * Flush both queues and run the watchers.
 */
//数据发生变化的时候更新所有的队列的函数
function flushSchedulerQueue () {
  flushing = true
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 保证user watcher在渲染watcher之前触发
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
  queue.sort((a, b) => a.id - b.id)

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  //queue是watcher组成的队列
  //每次循环都会求queue的长度，因为这个队列长度可能会发生变化（一个watcher导致了别的响应式变量被修改了同时触发依赖收集，再次添加watcher）
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    //watch实例的options中含有before方法则执行，即执行beforeUpdate钩子（src/core/instance/lifecycle.js:217）
    if (watcher.before) {
      watcher.before()
    }
    id = watcher.id
    has[id] = null
    watcher.run()
    // in dev build, check and stop circular updates.

    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      //如果队列中有之前相同的watcher会给circular对象的这个id加一（当watch的回调修改了watch的变量会导致死循环）
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  //keep-alive
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()
 //当当前轮的queue全部遍历完之后，清空has对象,queue数组
  resetSchedulerState()

  // call component updated and activated hooks(2个生命周期钩子)
  callActivatedHooks(activatedQueue)
  callUpdatedHooks(updatedQueue)

  // devtool hook
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}

function callUpdatedHooks (queue) {
  let i = queue.length
  while (i--) {
    const watcher = queue[i]
    const vm = watcher.vm
    //只有当遍历到渲染watcher时才触发updated钩子
    if (vm._watcher === watcher && vm._isMounted && !vm._isDestroyed) {
      callHook(vm, 'updated')
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 */
export function queueActivatedComponent (vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  vm._inactive = false
  activatedChildren.push(vm)
}

function callActivatedHooks (queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    activateChildComponent(queue[i], true /* true */)
  }
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 */
//渲染watcher/用户定义的watcher
export function queueWatcher (watcher: Watcher) {
  const id = watcher.id
  //一开始has是一个空对象，这里是为了保证同一个watcher实例只触发一次
  if (has[id] == null) {
    has[id] = true
    if (!flushing) {
      //往队列里放入一个watcher实例
      queue.push(watcher)
    } else {
      //在flushSchedulerQueue的过程中，某个watch的回调内部又修改了响应式变量则会进入这个逻辑（user watcher）
      //此时flushSchedulerQueue还在遍历中
      // if already flushing, splice the watcher based on its id
      // if already past its id, it will be run next immediately.
      //i为queue数组的最后一个元素下标
      let i = queue.length - 1
      //index = 0
      //因为queue队列是按id顺序排列的
      // 这里会尝试按照当前传入的watcher的id找到顺序queue数组的相应的位置插入
      while (i > index && queue[i].id > watcher.id) {
        i--
      }
      queue.splice(i + 1, 0, watcher)
    }
    // queue the flush
    if (!waiting) {
      //当有一个任务被推进了queue队列中时，就会准备在nextTick中flushSchedulerQueue（执行所有队列）
      //这时声明了waiting标志位，防止重复执行nextTick，反复添加微任务，即第二次有watcher被放入queue不会触发下面逻辑
      waiting = true
      //vue暴露了一个是否异步更新队列的配合项,一般都会true,即下面这个逻辑一般为false
      if (process.env.NODE_ENV !== 'production' && !config.async) {
        flushSchedulerQueue()
        return
      }
      //在下一个tick（一半会是当前任务的微任务）执行flushSchedulerQueue
      nextTick(flushSchedulerQueue)
    }
  }
}
