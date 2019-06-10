/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

//在调用vue构造函数的时候会执行该方法初始化
export function initMixin (Vue: Class<Component>) {
  Vue.prototype._init = function (/*对于根实例传入的是new Vue的配置项,组件传入的是组件节点独有的配置项*/options?: Object) {
    const vm: Component = this
    // a uid
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    vm._isVue = true
    // merge options
    //如果是一个组件options(通过create-component.js调用的_init方法的_isComponent为true)
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      // 初始化组件的options（包括将父组件的监听事件赋值给子组件）
      initInternalComponent(vm, options)
    } else {
      //如果不是一个组件，即main.js声明的根实例，则合并传入构造函数的参数到$options（合并配置）
      vm.$options = mergeOptions(
        //返回Vue构造函数的options属性最初定义好的一些属性（src/core/global-api/index.js：47）
        resolveConstructorOptions(vm.constructor),
        //new Vue时候传入构造函数的对象
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      // 如果是开发环境会进行代理(src/core/instance/proxy.js)
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    initLifecycle(vm)
    //初始化自定义事件
    initEvents(vm)
    //初始化插槽，使$attr/$listeners响应式，定义createElement函数
    initRender(vm)
    //执行beforeCreate钩子（这个钩子执行的时候initState还没执行没有data等一系列属性）
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    // 初始化vue构造函数的属性(prop,data,methods,computed,watch)
    initState(vm)
    initProvide(vm) // resolve provide after data/props
    //执行created钩子（在上面initState函数执行后，即有了data,methods......一系列数据后）
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    // 如果有el属性就执行mount挂载到dom节点
    // $mount会将template通过vue-loader编译成渲染函数然后执行mountComponent(src/platforms/web/entry-runtime-with-compiler.js)
    // 核心是mountComponent函数(src/core/instance/lifecycle.js:154)
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

/**组件的初始化**/
export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  //vm.constructor.options为当前组件的构造函数的options属性，即组件对象和Vue全局的options合并而成的对象（src/core/global-api/extend.js:44）
  // 将这个options作为子组件实例的options属性
  const opts = vm.$options = Object.create(vm.constructor.options) // Sub.options
  // doing this because it's faster than dynamic enumeration.
  // 组件的options会有_parentVnode属性(父组件的占位符vnode)(src/core/vdom/create-component.js:245)
  const parentVnode = options._parentVnode
  //parent是父组件的根节点的vm实例（父组件的爸爸）
  opts.parent = options.parent
  //parentVnode是父组件的占位符vnode
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  //将父组件的监听事件，赋值到当前组件options._parentListeners属性中
  opts._parentListeners = vnodeComponentOptions.listeners
  // 将父组件的插槽节点赋值给子组件的 $options
  // 组件是没有 children 属性的，这里的 children 属性保存在 vnode.componentOptions.children 中
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

//Ctor为Vue
export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const extended = Ctor.extendOptions
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = dedupe(latest[key], extended[key], sealed[key])
    }
  }
  return modified
}

function dedupe (latest, extended, sealed) {
  // compare latest and sealed to ensure lifecycle hooks won't be duplicated
  // between merges
  if (Array.isArray(latest)) {
    const res = []
    sealed = Array.isArray(sealed) ? sealed : [sealed]
    extended = Array.isArray(extended) ? extended : [extended]
    for (let i = 0; i < latest.length; i++) {
      // push original options and not sealed options to exclude duplicated options
      if (extended.indexOf(latest[i]) >= 0 || sealed.indexOf(latest[i]) < 0) {
        res.push(latest[i])
      }
    }
    return res
  } else {
    return latest
  }
}
