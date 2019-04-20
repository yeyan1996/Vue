/* @flow */

import type VNode from 'core/vdom/vnode'

/**
 * Runtime helper for resolving raw children VNodes into a slot object.
 */
//返回slots对象，属性是插槽的名字，值是对应的这个插槽所包含的父组件的插入节点
//子节点会收集到父组件的children组成的vnode数组放入$slot，作为renderSlot的变量
export function resolveSlots (
  //父组件的children
  children: ?Array<VNode>,
  //父节点
  context: ?Component
): { [key: string]: Array<VNode> } {
  //声明一个保存所有插槽的对象,最后返回这个对象作为vm.$slots
  const slots = {}
  if (!children) {
    return slots
  }
  for (let i = 0, l = children.length; i < l; i++) {
    const child = children[i]
    const data = child.data
    // remove slot attribute if the node is resolved as a Vue slot node
    if (data && data.attrs && data.attrs.slot) {
      delete data.attrs.slot
    }
    // named slots should only be respected if the vnode was rendered in the
    // same context.
    if ((child.context === context || child.fnContext === context) &&
      data && data.slot != null
    ) {
      //获取具名插槽的名字（字符串）
      const name = data.slot
      const slot = (slots[name] || (slots[name] = []))
      if (child.tag === 'template') {
        slot.push.apply(slot, child.children || [])
      } else {
        //将父组件的对应的节点放到它定义的具名插槽的数组中
        slot.push(child)
      }
    } else { //否则放到默认插槽中作为它的children
      (slots.default || (slots.default = [])).push(child)
    }
  }
  // ignore slots that contains only whitespace
  for (const name in slots) {
    if (slots[name].every(isWhitespace)) {
      delete slots[name]
    }
  }
  return slots
}

function isWhitespace (node: VNode): boolean {
  return (node.isComment && !node.asyncFactory) || node.text === ' '
}

//格式化data对象的scopedSlot属性,由{key:aaa,value:bbb} => {aaa:bbb}
export function resolveScopedSlots (
  fns: ScopedSlotsData, // see flow/vnode
  res?: Object
): { [key: string]: Function } {
  res = res || {}
  for (let i = 0; i < fns.length; i++) {
    if (Array.isArray(fns[i])) {
      resolveScopedSlots(fns[i], res)
    } else {
      res[fns[i].key] = fns[i].fn
    }
  }
  return res
}
