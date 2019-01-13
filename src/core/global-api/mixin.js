/* @flow */

import { mergeOptions } from '../util/index'

//当使用全局的mixin时会将配置项混入到Vue构造函数的options属性中
export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
