/* @flow */

import VNode from './vnode'
import { resolveConstructorOptions } from 'core/instance/init'
import { queueActivatedComponent } from 'core/observer/scheduler'
import { createFunctionalComponent } from './create-functional-component'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isObject
} from '../util/index'

import {
  resolveAsyncComponent,
  createAsyncPlaceholder,
  extractPropsFromVNodeData
} from './helpers/index'

import {
  callHook,
  activeInstance,
  updateChildComponent,
  activateChildComponent,
  deactivateChildComponent
} from '../instance/lifecycle'

import {
  isRecyclableComponent,
  renderRecyclableComponentTemplate
} from 'weex/runtime/recycle-list/render-component-template'

// inline hooks to be invoked on component VNodes during patch
//声明了组件vnode的生命周期钩子
const componentVNodeHooks = {
  //init钩子会根据子组件的vnode创建子组件实例
  init (vnode: VNodeWithData, hydrating: boolean): ?boolean {
    if (
      vnode.componentInstance &&
      !vnode.componentInstance._isDestroyed &&
      vnode.data.keepAlive
    ) {
      //如果组件被keep-alive缓存过了,则会直接prepatch不会在执行$mount(也就不会触发mounted,created等钩子)
      // kept-alive components, treat as a patch
      const mountedNode: any = vnode // work around flow
      //直接执行prepatch更新逻辑
      componentVNodeHooks.prepatch(mountedNode, mountedNode)
    } else {
      //createComponentInstanceForVnode通过调用子组件的构造器返回子组件的实例
      const child = vnode.componentInstance = createComponentInstanceForVnode(
        vnode,
        //实例
        activeInstance
      )
      /**子组件实例不会在Vue.init时候执行mount,因为没有el属性,而在这里主动执行mountComponent函数(src/core/instance/lifecycle.js:148)**/
      child.$mount(hydrating ? vnode.elm : undefined, hydrating)
    }
  },
 //给子组件传值的时候,父组件数据变化会通过prepatch钩子通知子组件数据变化(src/core/vdom/patch.js:596执行prepatch)
  prepatch (oldVnode: MountedComponentVNode, vnode: MountedComponentVNode) {
    const options = vnode.componentOptions
    /**prepatch时,新节点和旧节点使用的是相同的vm实例,新节点会复用旧节点中所有的数据**/
    const child = vnode.componentInstance = oldVnode.componentInstance
    //prepatch只会更新新旧节点的props/listeners
    updateChildComponent(
      child, //新旧节点共用的vm实例
      options.propsData, // updated props //新vnode的props对象
      options.listeners, // updated listeners
      vnode, // new parent vnode
      options.children // new children
    )
  },
  //insert钩子用来触发子组件的mounted钩子
  insert (vnode: MountedComponentVNode) {
    const { context, componentInstance } = vnode
    if (!componentInstance._isMounted) {
      //如果没有执行过mounted的钩子就执行它，并且是先子=》父
      componentInstance._isMounted = true
      callHook(componentInstance, 'mounted')
    }
    //执行keep-alive的生命周期（activated,deactivated）
    if (vnode.data.keepAlive) {
      if (context._isMounted) {
        // vue-router#1212
        // During updates, a kept-alive component's child components may
        // change, so directly walking the tree here may call activated hooks
        // on incorrect children. Instead we push them into a queue which will
        // be processed after the whole patch process ended.
        //keep-alive节点，使用缓存中的vnode时，维护一个队列在nextTick的watchers都被执行后，执行activated钩子
        queueActivatedComponent(componentInstance)
      } else {
        //keep-alive包裹的节点第一次mounted会遍历并且执行内部所有的activated钩子
        activateChildComponent(componentInstance, true /* direct */)
      }
    }
  },
  //销毁组件钩子
  destroy (vnode: MountedComponentVNode) {
    const { componentInstance } = vnode
    if (!componentInstance._isDestroyed) {

      if (!vnode.data.keepAlive) {
        componentInstance.$destroy()
      } else {
        ////keepalive包裹的子组件不会执行destroy钩子，相反会触发deavtivated钩子
        deactivateChildComponent(componentInstance, true /* direct */)
      }
    }
  }
}

const hooksToMerge = Object.keys(componentVNodeHooks)

//创建组件vnode
export function createComponent (
  Ctor: Class<Component> | Function | Object | void,
  data: ?VNodeData,
  context: Component, //vm实例
  children: ?Array<VNode>,
  tag?: string
): VNode | Array<VNode> | void {
  if (isUndef(Ctor)) {
    return
  }

  //_base为Vue构造函数（src/core/global-api/index.js:54）
  const baseCtor = context.$options._base

  // plain options object: turn it into a constructor
  /**继承Vue构造函数**/
  //如果第一个参数为组件options时调用Vue.extend()传入这个对象，返回一个子类的构造器函数(保证Ctor是一个函数)
  // Vue.extend在src/core/global-api/extend.js:20
  if (isObject(Ctor)) {
    Ctor = baseCtor.extend(Ctor)
  }

  // if at this stage it's not a constructor or an async component factory,
  // reject.
  if (typeof Ctor !== 'function') {
    if (process.env.NODE_ENV !== 'production') {
      warn(`Invalid Component definition: ${String(Ctor)}`, context)
    }
    return
  }

  // async component
  let asyncFactory
  if (isUndef(Ctor.cid)) {
    asyncFactory = Ctor
    //解析异步组件
    Ctor = resolveAsyncComponent(asyncFactory, baseCtor, context)
    //如果非高级组件，创建一个空的注释节点占位
    if (Ctor === undefined) {
      // return a placeholder node for async component, which is rendered
      // as a comment node but preserves all the raw information for the node.
      // the information will be used for async server-rendering and hydration.
      return createAsyncPlaceholder(
        asyncFactory,
        data,
        context,
        children,
        tag
      )
    }
  }

  data = data || {}

  // resolve constructor options in case global mixins are applied after
  // component constructor creation
  resolveConstructorOptions(Ctor)

  // transform component v-model data into props & events
  if (isDef(data.model)) {
    transformModel(Ctor.options, data)
  }

  // extract props
  const propsData = extractPropsFromVNodeData(data, Ctor, tag)

  // functional component
  if (isTrue(Ctor.options.functional)) {
    return createFunctionalComponent(Ctor, propsData, data, context, children)
  }

  // extract listeners, since these needs to be treated as
  // child component listeners instead of DOM listeners

  //将组件的监听事件保存在listeners变量中,并且将原生的监听事件赋值给on属性
  //并且这个自定义事件会作为组件的options在子组件初始化执行init的时候执行initEvent
  const listeners = data.on
  // replace with listeners with .native modifier
  // so it gets processed during parent component patch.
  data.on = data.nativeOn

  if (isTrue(Ctor.options.abstract)) {
    // abstract components do not keep anything
    // other than props & listeners & slot

    // work around flow
    const slot = data.slot
    data = {}
    if (slot) {
      data.slot = slot
    }
  }

  // install component management hooks onto the placeholder node
  //让组件的data.hooks属性拥有一些组件的钩子函数（init,prepatch,insert,destroy）
  installComponentHooks(data)

  // return a placeholder vnode
  const name = Ctor.options.name || tag
  //实例化vnode，第3，4，5参数为空（children,text,elm）
  const vnode = new VNode(
    // 组件vnode的tag名和一般的不一样（方便调试）
    `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
    data, undefined, undefined, undefined, context,
    //第6个参数（componentOptions）即组件的构造函数,props，listeners，tag,children组成的对象
    { Ctor, propsData, listeners, tag, children },
    asyncFactory
  )

  // Weex specific: invoke recycle-list optimized @render function for
  // extracting cell-slot template.
  // https://github.com/Hanks10100/weex-native-directive/tree/master/component
  /* istanbul ignore if */
  if (__WEEX__ && isRecyclableComponent(vnode)) {
    return renderRecyclableComponentTemplate(vnode)
  }

  //返回组件vnode
  return vnode
}

//通过组件构造器实例化子组件实例
export function createComponentInstanceForVnode (
  //组件vnode
  vnode: any, // we know it's MountedComponentVNode but flow doesn't
  //parent为当前组件的父实例
  parent: any, // activeInstance in lifecycle state
): Component {
  //Vue内部实例化组件构造器的时候会传一些额外的options来维护父子关系
  const options: InternalComponentOptions = {
    _isComponent: true,
    // 占位符vnode即在父组件中表名这个是一个组件的标签<hello-world>
    // 它是一个vnode，依靠子组件渲染出真正的vnode（渲染vnode）和dom节点（将DOM节点赋值给占位符vnode的elm属性）
    _parentVnode: vnode,
    parent
  }
  // check inline-template render functions
  const inlineTemplate = vnode.data.inlineTemplate
  if (isDef(inlineTemplate)) {
    options.render = inlineTemplate.render
    options.staticRenderFns = inlineTemplate.staticRenderFns
  }
  // componentOptions即传入vnode类的第6个构造函数（209）
  // 和new Vue类似,但是这里换成在框架内部被动的实例化vm
  // 这里等于new Ctor(options),等于执行了内部的_init方法(src/core/global-api/extend.js:38) Ctor=>Counstructor
  // 即调用了Vue._init方法(但是某些参数会有改变,多了_isComponent,parent,_parentVnode3个属性)
  //同时返回了一个子组件的实例
  return new vnode.componentOptions.Ctor(options)
}

//data是传入render函数的配置项data
//让data.hooks属性拥有一些组件的钩子函数（init,prepatch,insert,destroy）
function installComponentHooks (data: VNodeData) {
  const hooks = data.hook || (data.hook = {})
  //hooksToMerge为（37）对象的所有键名（init,prepatch,insert,destroy）
  for (let i = 0; i < hooksToMerge.length; i++) {
    const key = hooksToMerge[i]
    const existing = hooks[key]
    //找到在componentVNodeHooks和data.hook中都有的键名（方法名），并且返回这个方法（函数）
    const toMerge = componentVNodeHooks[key]
    //如果data的hooks属性中和componentVNodeHooks的方法不一样且hooks没有被合并过，则将componentVNodeHooks和data.hooks进行合并
    //合并策略为先执行componentVNodeHooks中的再执行data.hooks中的相应方法
    if (existing !== toMerge && !(existing && existing._merged)) {
      hooks[key] = existing ? mergeHook(toMerge, existing) : toMerge
    }
  }
}

function mergeHook (f1: any, f2: any): Function {
  const merged = (a, b) => {
    // flow complains about extra args which is why we use any
    f1(a, b)
    f2(a, b)
  }
  merged._merged = true
  return merged
}

// transform component v-model info (value and callback) into
// prop and event handler respectively.
function transformModel (options, data: any) {
  const prop = (options.model && options.model.prop) || 'value'
  const event = (options.model && options.model.event) || 'input'
  ;(data.props || (data.props = {}))[prop] = data.model.value
  const on = data.on || (data.on = {})
  const existing = on[event]
  const callback = data.model.callback
  if (isDef(existing)) {
    if (
      Array.isArray(existing)
        ? existing.indexOf(callback) === -1
        : existing !== callback
    ) {
      on[event] = [callback].concat(existing)
    }
  } else {
    on[event] = callback
  }
}
