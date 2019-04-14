/* @flow */

import { warn } from 'core/util/index'

import {
  cached,
  isUndef,
  isTrue,
  isPlainObject
} from 'shared/util'

const normalizeEvent = cached((name: string): {
  name: string,
  once: boolean,
  capture: boolean,
  passive: boolean,
  handler?: Function,
  params?: Array<any>
} => {
  const passive = name.charAt(0) === '&'
  name = passive ? name.slice(1) : name
  const once = name.charAt(0) === '~' // Prefixed last, checked first
  name = once ? name.slice(1) : name
  const capture = name.charAt(0) === '!'
  name = capture ? name.slice(1) : name
  return {
    name,
    once,
    capture,
    passive
  }
})

export function createFnInvoker (fns: Function | Array<Function>): Function {
  //这个函数是真正的事件处理程序(addEventLister会给handler回调自动传入一个event的事件对象，即invoker函数会自动获得一个event的事件对象)
  function invoker () {
    const fns = invoker.fns
      //如果是数组(对同一个事件绑定多个事件处理程序)
    if (Array.isArray(fns)) {
      const cloned = fns.slice()
      for (let i = 0; i < cloned.length; i++) {
        //arguments即event事件对象
        cloned[i].apply(null, arguments)
      }
    } else {
      // return handler return value for single handlers
      //这个地方直接使用argument将事件对象和其余参数一并传入事件处理程序中
      return fns.apply(null, arguments)
    }
  }
  //给invoker函数的fns属性添加所有的事件，这样做是因为在vdom更新的时候方便将新的fns替换为旧的fns
  invoker.fns = fns
  return invoker
}

//创建/更新自定义事件和DOM原生事件
export function updateListeners (
  on: Object,
  oldOn: Object,
  add: Function,
  remove: Function,
  createOnceHandler: Function,
  vm: Component
) {
  let name, def, cur, old, event
  for (name in on) {
    //每个监听事件的cur都是不同的
    def = cur = on[name]
    old = oldOn[name]
    //解析修饰符(~,&,!之类的符号(在编译阶段会将capture等部分修饰符换成符号))
    event = normalizeEvent(name)
    /* istanbul ignore if */
    if (__WEEX__ && isPlainObject(def)) {
      cur = def.handler
      event.params = def.params
    }
    if (isUndef(cur)) {
      process.env.NODE_ENV !== 'production' && warn(
        `Invalid handler for event "${event.name}": got ` + String(cur),
        vm
      )
    } else if (isUndef(old)) { //开始创建事件
      if (isUndef(cur.fns)) {
        //cur为invoker函数，invoker的fns属性为
        cur = on[name] = createFnInvoker(cur)
      }
      //如果有once标记则在执行一次后,调用removeListener移除事件处理程序(src/platforms/web/runtime/modules/events.js:31)
      if (isTrue(event.once)) {
        cur = on[name] = createOnceHandler(event.name, cur, event.capture)
      }
      add(event.name, cur, event.capture, event.passive, event.params)
    } else if (cur !== old) { //开始更新事件
      //只要将旧的fns属性指向新的事件处理程序即可
      old.fns = cur
      on[name] = old
    }
  }
  for (name in oldOn) {
    if (isUndef(on[name])) {
      event = normalizeEvent(name)
      remove(event.name, oldOn[name], event.capture)
    }
  }
}
