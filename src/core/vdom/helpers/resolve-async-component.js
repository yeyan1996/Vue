/* @flow */

import {
  warn,
  once,
  isDef,
  isUndef,
  isTrue,
  isObject,
  hasSymbol
} from 'core/util/index'

import { createEmptyVNode } from 'core/vdom/vnode'

function ensureCtor (comp: any, base) {
  if (
    comp.__esModule ||
    (hasSymbol && comp[Symbol.toStringTag] === 'Module')
  ) {
    comp = comp.default
  }
  return isObject(comp)
    ? base.extend(comp)
    : comp
}

export function createAsyncPlaceholder (
  factory: Function,
  data: ?VNodeData,
  context: Component,
  children: ?Array<VNode>,
  tag: ?string
): VNode {
  const node = createEmptyVNode()
  node.asyncFactory = factory
  node.asyncMeta = { data, context, children, tag }
  return node
}

//解析异步组件
export function resolveAsyncComponent (
  factory: Function, //promise的异步组件 factory 为 () => import (.....)
  baseCtor: Class<Component>,
  context: Component
): Class<Component> | void {
  if (isTrue(factory.error) && isDef(factory.errorComp)) {
    return factory.errorComp
  }

  // 当通过$forceUpdate再次进入到 resolveAsyncComponent 函数时，由于异步组件以及被解析，所以会有 resolved 方法
  // 直接返回（81）中的组件构造器
  if (isDef(factory.resolved)) {
    return factory.resolved
  }

  if (isTrue(factory.loading) && isDef(factory.loadingComp)) {
    return factory.loadingComp
  }

  if (isDef(factory.contexts)) {
    // already pending
    factory.contexts.push(context)
  } else {
    const contexts = factory.contexts = [context]
    let sync = true

    const forceRender = (renderCompleted: boolean) => {
      for (let i = 0, l = contexts.length; i < l; i++) {
        contexts[i].$forceUpdate()
      }

      if (renderCompleted) {
        contexts.length = 0
      }
    }
    //once只执行一次
    /**以下代码会等到异步组件获取到后，在微任务队列中执行**/
    const resolve = once((res: Object | Class<Component>) => {
      // cache resolved
      // ensureCtor将res(通过import()导入的异步组件的options)解析为异步组件的构造器
      factory.resolved = ensureCtor(res, baseCtor)
      // invoke callbacks only if this is not a synchronous resolve
      // (async resolves are shimmed as synchronous during SSR)
      // 强制刷新视图创建组件（forceRender函数会再次执行resolveAsyncComponent这个函数）
      if (!sync) {
        forceRender(true)
      }
    })

    const reject = once(reason => {
      process.env.NODE_ENV !== 'production' && warn(
        `Failed to resolve async component: ${String(factory)}` +
        (reason ? `\nReason: ${reason}` : '')
      )
      //定义了error组件就渲染error组件
      if (isDef(factory.errorComp)) {
        factory.error = true
        forceRender(true)
      }
    })
    //如果使用Promise的异步组件,factory为()=>import(.......)这个函数，res为一个Promise对象（res也可能是对象即使用高级异步组件）
    const res = factory(resolve, reject)

    if (isObject(res)) {
      if (typeof res.then === 'function') {
        // () => Promise
        // 第一次factory.resolved是没有定义的
        // 所以给promise.then传入resolve,reject2个函数等Promise决议后执行回调
        if (isUndef(factory.resolved)) {
          res.then(resolve, reject)
        }
        //高级异步组件
      } else if (isDef(res.component) && typeof res.component.then === 'function') {
        res.component.then(resolve, reject)

        if (isDef(res.error)) {
          factory.errorComp = ensureCtor(res.error, baseCtor) //返回一个显示错误的组件的构造器
        }

        if (isDef(res.loading)) {
          factory.loadingComp = ensureCtor(res.loading, baseCtor) //返回一个显示loading的组件的构造器
          if (res.delay === 0) { //delay配置项是0的话直接渲染loading组件
            factory.loading = true
          } else {
            setTimeout(() => {
              if (isUndef(factory.resolved) && isUndef(factory.error)) {
                factory.loading = true
                forceRender(false)
              }
            }, res.delay || 200)
          }
        }

        //超时调用reject
        if (isDef(res.timeout)) {
          setTimeout(() => {
            if (isUndef(factory.resolved)) {
              reject(
                process.env.NODE_ENV !== 'production'
                  ? `timeout (${res.timeout}ms)`
                  : null
              )
            }
          }, res.timeout)
        }
      }
    }

    sync = false
    // return in case resolved synchronously
    // 异步组件返回一个Undefined
    return factory.loading
      ? factory.loadingComp //渲染一个loading组件
      : factory.resolved // 返回undefined时会先渲染一个注释节点
  }
}
