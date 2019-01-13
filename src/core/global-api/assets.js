/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { isPlainObject, validateComponentName } from '../util/index'
import {resolveAsset} from "../util";

export function initAssetRegisters (Vue: GlobalAPI) {
  /**
   * Create asset registration methods.
   */
  //注册全局组件，或者自定义指令，过滤器（局部组件不在这里注册）
  //全局组件之所以所有组件都能访问到是因为扩展在Vue.options中
  ASSET_TYPES.forEach(type => {
    Vue[type] = function (
      id: string,
      definition: Function | Object
    ): Function | Object | void {
      if (!definition) {
        return this.options[type + 's'][id]
      } else {
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production' && type === 'component') {
          validateComponentName(id)
        }
        //判断是不是一个普通组件对象（非异步组件）
        if (type === 'component' && /*异步组件这个为false*/isPlainObject(definition)) {
          definition.name = definition.name || id
          //将component的第二个参数（组件对象）转化为一个继承自Vue的构造函数
          definition = this.options._base.extend(definition)
        }
        if (type === 'directive' && typeof definition === 'function') {
          definition = { bind: definition, update: definition }
        }
        //给options属性添加这个组件/指令/过滤器
        //注意这个函数执行完后只是在options属性中添加了一个属性值为这个构造器，但是并没有生成这个组件，在执行Vue.init的时候才会生成
        //在组件创建的过程中会生成对应的组件/指令/过滤器 resolveAsset（src/core/vdom/create-element.js:116）
        this.options[type + 's'][id] = definition
        //返回这个构造函数
        return definition
      }
    }
  })
}
