/* @flow */
/* globals MessageChannel */

import { noop } from 'shared/util'
import { handleError } from './error'
import { isIOS, isNative } from './env'

const callbacks = []
let pending = false

function flushCallbacks () {
  pending = false
  const copies = callbacks.slice(0)
  callbacks.length = 0
  for (let i = 0; i < copies.length; i++) {
    //先添加的回调函数先执行
    //@example
    //data(){return { msg:'hello world' }}
    //this.$nextTick(()=>{console.log(this.$refs.msg.innerHTML)})
    //this.msg = 'hello vue'
    //console.log(this.$refs.msg.innerHTML)
    //最后输出的是2个hello world,因为第一个nextTick将回调push到callbacks,修改msg会将渲染视图的回调(flushSchedulerQueue)push到callbacks
    //但是由于是按顺序遍历数组,nextTick的回调会先执行,所以仍然输出的是'hello world'
    copies[i]()
  }
}

// Here we have async deferring wrappers using both microtasks and (macro) tasks.
// In < 2.4 we used microtasks everywhere, but there are some scenarios where
// microtasks have too high a priority and fire in between supposedly
// sequential events (e.g. #4521, #6690) or even between bubbling of the same
// event (#6566). However, using (macro) tasks everywhere also has subtle problems
// when state is changed right before repaint (e.g. #6813, out-in transitions).
// Here we use microtask by default, but expose a way to force (macro) task when
// needed (e.g. in event handlers attached by v-on).
let microTimerFunc
let macroTimerFunc
let useMacroTask = false

// Determine (macro) task defer implementation.
// Technically setImmediate should be the ideal choice, but it's only available
// in IE. The only polyfill that consistently queues the callback after all DOM
// events triggered in the same loop is by using MessageChannel.
/* istanbul ignore if */
//判断浏览器是否原生支持setImmediate
if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
  macroTimerFunc = () => {
    setImmediate(flushCallbacks)
  }
  //没有则判断是否原生支持MessageChannel
} else if (typeof MessageChannel !== 'undefined' && (
  isNative(MessageChannel) ||
  // PhantomJS
  MessageChannel.toString() === '[object MessageChannelConstructor]'
)) {
  const channel = new MessageChannel()
  const port = channel.port2
  channel.port1.onmessage = flushCallbacks
  macroTimerFunc = () => {
    port.postMessage(1)
  }
} else {
  /* istanbul ignore next */
  //否则macroTimerFunc降级为setTimeout 0
  macroTimerFunc = () => {
    //在下个宏任务中执行flushCallbacks
    setTimeout(flushCallbacks, 0)
  }
}

// Determine microtask defer implementation.
/* istanbul ignore next, $flow-disable-line */
//判断是否原生支持Promise
if (typeof Promise !== 'undefined' && isNative(Promise)) {
  const p = Promise.resolve()
  microTimerFunc = () => {
    //在微任务中执行flushCallbacks
    p.then(flushCallbacks)
    // in problematic UIWebViews, Promise.then doesn't completely break, but
    // it can get stuck in a weird state where callbacks are pushed into the
    // microtask queue but the queue isn't being flushed, until the browser
    // needs to do some other work, e.g. handle a timer. Therefore we can
    // "force" the microtask queue to be flushed by adding an empty timer.
    if (isIOS) setTimeout(noop)
  }
} else {
  //将microTimer降级为macroTimerFunc
  // fallback to macro
  microTimerFunc = macroTimerFunc
}

/**
 * Wrap a function so that if any code inside triggers state change,
 * the changes are queued using a (macro) task instead of a microtask.
 */
export function withMacroTask (fn: Function): Function {
  return fn._withTask || (fn._withTask = function () {
    useMacroTask = true
    try {
      return fn.apply(null, arguments)
    } finally {
      useMacroTask = false
    }
  })
}

export function nextTick (cb?: Function, ctx?: Object) {
  let _resolve
  //给回调数组添加一个回调函数
  callbacks.push(() => {
    if (cb) {
      try {
        cb.call(ctx)
      } catch (e) {
        handleError(e, ctx, 'nextTick')
      }
      //如果回调不是一个函数(即this.$nextTick()的情况)将this.$nextTick这个Promise的状态变为resolve,有上下文也会传入作为this.$nextTick决议后的值
    } else if (_resolve) {
      _resolve(ctx)
    }
  })
  if (!pending) {
    pending = true

    //只有DOM事件的回调执行的时候useMacroTask为true,此时处在下个宏任务队列,让nextTick在再下个宏任务队列中执行
    if (useMacroTask) {
      macroTimerFunc()
    } else {
      microTimerFunc()
    }
  }
  //cb不存在且支持原生Promise就让this.$nextTick返回一个Promise
  // $flow-disable-line
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      _resolve = resolve
    })
  }
}
