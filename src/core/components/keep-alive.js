/* @flow */

import { isRegExp, remove } from 'shared/util'
import { getFirstComponentChild } from 'core/vdom/helpers/index'

type VNodeCache = { [key: string]: ?VNode };

function getComponentName (opts: ?VNodeComponentOptions): ?string {
  return opts && (opts.Ctor.options.name || opts.tag)
}

function matches (pattern: string | RegExp | Array<string>, name: string): boolean {
  if (Array.isArray(pattern)) {
    return pattern.indexOf(name) > -1
  } else if (typeof pattern === 'string') {
    return pattern.split(',').indexOf(name) > -1
  } else if (isRegExp(pattern)) {
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}

function pruneCache (keepAliveInstance: any, filter: Function) {
  const { cache, keys, _vnode } = keepAliveInstance
  for (const key in cache) {
    //cache对象中的每个vnode
    const cachedNode: ?VNode = cache[key]
    if (cachedNode) {
      //获取组件的name
      const name: ?string = getComponentName(cachedNode.componentOptions)
      if (name && !filter(name)) { //如果执行了filter后返回false，即不在需要缓存的列表中，会进入下面的逻辑，在cache对象中删除这个vnode
        pruneCacheEntry(cache, key, keys, _vnode)
      }
    }
  }
}

//调用vnode的实例的$destroy销毁当前组件
function pruneCacheEntry (
  cache: VNodeCache,
  key: string,
  keys: Array<string>,
  current?: VNode
) {
  const cached = cache[key]
  if (cached && (!current || cached.tag !== current.tag)) {
    cached.componentInstance.$destroy()
  }
  cache[key] = null
  remove(keys, key)
}

const patternTypes: Array<Function> = [String, RegExp, Array]

export default {
  name: 'keep-alive',
  //抽象组件（src/core/instance/lifecycle.js:41）
  //抽象组件不会被添加到父实例的$children中
  abstract: true,

  props: {
    include: patternTypes,
    exclude: patternTypes,
    max: [String, Number]
  },

  //初始化cache/keys
  created () {
    this.cache = Object.create(null)
    this.keys = []
  },

  destroyed () {
    //清空cache对象所有保存的vnode
    for (const key in this.cache) {
      pruneCacheEntry(this.cache, key, this.keys)
    }
  },

  mounted () {
    //监听include/exclude的改变,根据规则在cache映射表中过滤不符合的name对应的vnode,并且执行销毁vnode的$destroy方法
    this.$watch('include', val => {
      pruneCache(this, name => matches(val, name))
    })
    this.$watch('exclude', val => {
      pruneCache(this, name => !matches(val, name))
    })
  },

  render () {
    const slot = this.$slots.default
    //获取keep-alive组件插槽中的第一个组件vnode
    const vnode: VNode = getFirstComponentChild(slot)
    const componentOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions
    if (componentOptions) {
      // check pattern
      const name: ?string = getComponentName(componentOptions)
      const { include, exclude } = this
      if (
        // not includedkeys
        (include && (!name || !matches(include, name))) ||
        // excluded
        (exclude && name && matches(exclude, name))
      ) {
        return vnode
      }

      const { cache, keys } = this
      //获取该组件的key
      const key: ?string = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
        //生成每个组件唯一的key
        ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
        : vnode.key
      //如果cache中包含这个key对应的vnode
      if (cache[key]) {
        //将新渲染的vnode的vm实例等于旧vnode的vm实例
        //这样vm就是之前的vm，其中的数据就得以保留
        vnode.componentInstance = cache[key].componentInstance
        // make current key freshest
        //当当前组件被使用过后会把它放到keys数组(栈)的最上面,在数组中更新这个vnode
        remove(keys, key)
        keys.push(key)
      } else {
        //如果cache中没有这个组件则在cache中记录这个组件
        cache[key] = vnode
        keys.push(key)
        // prune oldest entry
        //如果设置了max(防止keep-alive组件存储过多的vnode占用内存)
        //会根据max去除在keys数组栈底的元素(去除使用频率最低的vnode),同时会执行销毁vnode的$destroy方法
        if (this.max && keys.length > parseInt(this.max)) {
          pruneCacheEntry(cache, keys[0], keys, this._vnode)
        }
      }
    //设置keepalive标记位
      vnode.data.keepAlive = true
    }
    return vnode || (slot && slot[0])
  }
}
