/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { defineComputed, proxy } from '../instance/state'
import { extend, mergeOptions, validateComponentName } from '../util/index'

export function initExtend (Vue: GlobalAPI) {
  /**
   * Each instance constructor, including Vue, has a unique
   * cid. This enables us to create wrapped "child
   * constructors" for prototypal inheritance and cache them.
   */
  Vue.cid = 0
  let cid = 1

  /**
   * Class inheritance
   */
  // 继承Vue构造函数的一些方法和属性（传入组件的options参数）返回组件的构造器
  // 当给render函数的tag配置项是一个组件对象会转变成一个组件构造器（src/core/vdom/create-component.js:126），extendOptions为组件对象
  Vue.extend = function (extendOptions: Object): Function {
    extendOptions = extendOptions || {}
    const Super = this
    const SuperId = Super.cid
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    if (cachedCtors[SuperId]) {
      //如果被缓存过了提前返回这个子类构造函数Sub,适用于多个相同的组件避免生成多个构造器
      return cachedCtors[SuperId]
    }

    const name = extendOptions.name || Super.options.name
    if (process.env.NODE_ENV !== 'production' && name) {
      // 校验组件的name
      validateComponentName(name)
    }
   /**实例化子类构造函数的时候需要传入options(组件对象),并且执行Vue的_init方法(执行一系列生命周期,初始化data,.....) **/
    const Sub = function VueComponent (options) {
      this._init(options)
    }
    // 继承了Vue构造函数的原型对象（寄生组合式继承）
    Sub.prototype = Object.create(Super.prototype)
    Sub.prototype.constructor = Sub
    Sub.cid = cid++
    //定义子类构造函数的options属性为这个组件对象的属性和Vue.options合并
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    )
    Sub['super'] = Super

    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.
    if (Sub.options.props) {
      initProps(Sub)
    }
    //这里已经提前把computed属性放到了组件的原型上，提前执行了defineComputed函数生成了属性的getter（src/core/instance/state.js:225）
    //因为可以让多个组件共享computed属性，节约性能
    if (Sub.options.computed) {
      initComputed(Sub)
    }

    // allow further extension/mixin/plugin usage
    //让这个子类构造器拥有Vue构造器的一些静态方法
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // create asset registers, so extended classes
    // can have their private assets too.
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })
    // enable recursive self-lookup
    //在构造器的options.components的name属性指向自身这个构造器
    if (name) {
      Sub.options.components[name] = Sub
    }

    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.
    Sub.superOptions = Super.options
    Sub.extendOptions = extendOptions
    Sub.sealedOptions = extend({}, Sub.options)

    // cache constructor
    // 缓存了这个子类构造函数，可以在渲染多个相同组件时，只生成一个子类构造器节约性能
    cachedCtors[SuperId] = Sub
    return Sub
  }
}

function initProps (Comp) {
  const props = Comp.options.props
  for (const key in props) {
    proxy(Comp.prototype, `_props`, key)
  }
}

function initComputed (Comp) {
  const computed = Comp.options.computed
  for (const key in computed) {
    defineComputed(Comp.prototype, key, computed[key])
  }
}
