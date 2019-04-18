/* @flow */

import { extend, warn, isObject } from 'core/util/index'

/**
 * Runtime helper for rendering <slot>
 */
//对应编译阶段的genSlot中的"_t"函数（src/compiler/codegen/index.js:498）
//render函数在执行的过程中遇到插槽会执行renderSlot函数
//返回占位符节点对应插槽所填入的vnode数组
export function renderSlot (
  name: string,
  //默认插槽内容（slot标签的子节点children） `<slot>默认内容</slot>`
  fallback: ?Array<VNode>,
  props: ?Object,
  bindObject: ?Object
): ?Array<VNode> {
  //this.$scopedSlots(src/core/instance/render.js:75)
  //拿到当前作用域插槽,在占位符节点生成的函数
  const scopedSlotFn = this.$scopedSlots[name]
  let nodes
  if (scopedSlotFn) { // scoped slot
    props = props || {}
    if (bindObject) {
      if (process.env.NODE_ENV !== 'production' && !isObject(bindObject)) {
        warn(
          'slot v-bind without argument expects an Object',
          this
        )
      }
      props = extend(extend({}, bindObject), props)
    }
    //执行这个函数返回vnode节点
    nodes = scopedSlotFn(props) || fallback
  } else {
    //$slots对象（src/core/instance/render-helpers/resolve-slots.js:9）
    //获取所有插槽集合中，当前插槽所需要填入的vnode数组（占位符节点中对应插槽的vnode数组）
    //如果子组件提供的插槽,但是占位符没有将插槽需要的节点插入,会进入fallback,渲染子组件插槽中的默认节点
    nodes = this.$slots[name] || fallback
  }

  const target = props && props.slot
  if (target) {
    return this.$createElement('template', { slot: target }, nodes)
  } else {
    return nodes
  }
}
