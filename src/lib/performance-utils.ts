/**
 * 性能优化工具函数
 * 包含防抖、节流、批处理等功能
 */

/**
 * 防抖函数 - 延迟执行，如果在延迟期间再次调用则重新计时
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number,
  options: {
    leading?: boolean  // 是否在延迟开始时立即执行
    trailing?: boolean // 是否在延迟结束时执行
    maxWait?: number   // 最大等待时间
  } = {}
): T & { cancel: () => void; flush: () => void } {
  let timeoutId: NodeJS.Timeout | null = null
  let maxTimeoutId: NodeJS.Timeout | null = null
  let lastCallTime = 0
  let lastInvokeTime = 0
  let lastArgs: Parameters<T> | undefined
  let lastThis: any
  let result: ReturnType<T>

  const { leading = false, trailing = true, maxWait } = options

  function invokeFunc(time: number) {
    const args = lastArgs!
    const thisArg = lastThis
    
    lastArgs = undefined
    lastThis = undefined
    lastInvokeTime = time
    result = func.apply(thisArg, args)
    return result
  }

  function leadingEdge(time: number) {
    lastInvokeTime = time
    timeoutId = setTimeout(timerExpired, delay)
    return leading ? invokeFunc(time) : result
  }

  function remainingWait(time: number) {
    const timeSinceLastCall = time - lastCallTime
    const timeSinceLastInvoke = time - lastInvokeTime
    const timeWaiting = delay - timeSinceLastCall

    return maxWait !== undefined
      ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
      : timeWaiting
  }

  function shouldInvoke(time: number) {
    const timeSinceLastCall = time - lastCallTime
    const timeSinceLastInvoke = time - lastInvokeTime

    return (
      lastCallTime === 0 ||
      timeSinceLastCall >= delay ||
      timeSinceLastCall < 0 ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    )
  }

  function timerExpired() {
    const time = Date.now()
    if (shouldInvoke(time)) {
      return trailingEdge(time)
    }
    timeoutId = setTimeout(timerExpired, remainingWait(time))
  }

  function trailingEdge(time: number) {
    timeoutId = null

    if (trailing && lastArgs) {
      return invokeFunc(time)
    }
    lastArgs = undefined
    lastThis = undefined
    return result
  }

  function cancel() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
    if (maxTimeoutId !== null) {
      clearTimeout(maxTimeoutId)
    }
    lastInvokeTime = 0
    lastCallTime = 0
    lastArgs = undefined
    lastThis = undefined
    timeoutId = null
    maxTimeoutId = null
  }

  function flush() {
    return timeoutId === null ? result : trailingEdge(Date.now())
  }

  function debounced(this: any, ...args: Parameters<T>) {
    const time = Date.now()
    const isInvoking = shouldInvoke(time)

    lastArgs = args
    lastThis = this
    lastCallTime = time

    if (isInvoking) {
      if (timeoutId === null) {
        return leadingEdge(lastCallTime)
      }
      if (maxWait !== undefined) {
        timeoutId = setTimeout(timerExpired, delay)
        return invokeFunc(lastCallTime)
      }
    }
    if (timeoutId === null) {
      timeoutId = setTimeout(timerExpired, delay)
    }
    return result
  }

  debounced.cancel = cancel
  debounced.flush = flush

  return debounced as unknown as T & { cancel: () => void; flush: () => void }
}

/**
 * 节流函数 - 限制函数执行频率
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number,
  options: {
    leading?: boolean  // 是否在节流开始时立即执行
    trailing?: boolean // 是否在节流结束时执行
  } = {}
): T & { cancel: () => void; flush: () => void } {
  return debounce(func, delay, {
    leading: options.leading !== false,
    trailing: options.trailing !== false,
    maxWait: delay
  })
}

/**
 * 批处理函数 - 将多个调用批量处理
 */
export function batchProcessor<T, R>(
  processor: (items: T[]) => Promise<R[]>,
  options: {
    batchSize?: number
    delay?: number
    maxWait?: number
  } = {}
): (item: T) => Promise<R> {
  const { batchSize = 10, delay = 100, maxWait = 1000 } = options
  
  let batch: Array<{
    item: T
    resolve: (result: R) => void
    reject: (error: any) => void
  }> = []
  
  let timeoutId: NodeJS.Timeout | null = null
  let maxTimeoutId: NodeJS.Timeout | null = null

  const processBatch = async () => {
    if (batch.length === 0) return

    const currentBatch = batch.splice(0, batchSize)
    const items = currentBatch.map(b => b.item)

    try {
      const results = await processor(items)
      currentBatch.forEach((b, index) => {
        b.resolve(results[index])
      })
    } catch (error) {
      currentBatch.forEach(b => {
        b.reject(error)
      })
    }

    // 如果还有剩余项目，继续处理
    if (batch.length > 0) {
      scheduleProcessing()
    }
  }

  const scheduleProcessing = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    
    timeoutId = setTimeout(processBatch, delay)

    // 设置最大等待时间
    if (!maxTimeoutId && maxWait > 0) {
      maxTimeoutId = setTimeout(() => {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        processBatch()
      }, maxWait)
    }
  }

  return (item: T): Promise<R> => {
    return new Promise((resolve, reject) => {
      batch.push({ item, resolve, reject })

      if (batch.length >= batchSize) {
        // 立即处理满批次
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        if (maxTimeoutId) {
          clearTimeout(maxTimeoutId)
          maxTimeoutId = null
        }
        processBatch()
      } else {
        scheduleProcessing()
      }
    })
  }
}

/**
 * 内存化函数 - 缓存函数结果
 */
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  options: {
    maxSize?: number
    ttl?: number
    keyGenerator?: (...args: Parameters<T>) => string
  } = {}
): T & { cache: Map<string, any>; clear: () => void } {
  const { maxSize = 100, ttl, keyGenerator } = options
  const cache = new Map<string, { value: ReturnType<T>; timestamp: number }>()

  const generateKey = keyGenerator || ((...args: Parameters<T>) => JSON.stringify(args))

  function memoized(this: any, ...args: Parameters<T>): ReturnType<T> {
    const key = generateKey(...args)
    const cached = cache.get(key)

    if (cached) {
      // 检查TTL
      if (!ttl || Date.now() - cached.timestamp < ttl) {
        return cached.value
      } else {
        cache.delete(key)
      }
    }

    // 如果缓存已满，删除最旧的条目
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value
      if (firstKey) {
        cache.delete(firstKey)
      }
    }

    const result = func.apply(this, args)
    cache.set(key, { value: result, timestamp: Date.now() })
    
    return result
  }

  memoized.cache = cache
  memoized.clear = () => cache.clear()

  return memoized as T & { cache: Map<string, any>; clear: () => void }
}

/**
 * 请求去重 - 防止相同请求的重复执行
 */
export function requestDeduplicator<T extends (...args: any[]) => Promise<any>>(
  func: T,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  const pendingRequests = new Map<string, Promise<ReturnType<T>>>()
  const generateKey = keyGenerator || ((...args: Parameters<T>) => JSON.stringify(args))

  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const key = generateKey(...args)
    
    // 如果已有相同请求在进行中，返回该请求的Promise
    if (pendingRequests.has(key)) {
      return pendingRequests.get(key)!
    }

    // 创建新请求
    const promise = func(...args).finally(() => {
      // 请求完成后清理
      pendingRequests.delete(key)
    })

    pendingRequests.set(key, promise)
    return promise
  }) as T
}

/**
 * 性能监控装饰器
 */
export function performanceMonitor<T extends (...args: any[]) => any>(
  func: T,
  name?: string
): T {
  const functionName = name || func.name || 'anonymous'

  return ((...args: Parameters<T>): ReturnType<T> => {
    const start = performance.now()
    
    try {
      const result = func(...args)
      
      // 如果是Promise，监控异步执行时间
      if (result && typeof result.then === 'function') {
        return result.finally(() => {
          const end = performance.now()
          console.debug(`[Performance] ${functionName} took ${(end - start).toFixed(2)}ms`)
        })
      }
      
      const end = performance.now()
      console.debug(`[Performance] ${functionName} took ${(end - start).toFixed(2)}ms`)
      return result
    } catch (error) {
      const end = performance.now()
      console.debug(`[Performance] ${functionName} failed after ${(end - start).toFixed(2)}ms`)
      throw error
    }
  }) as T
}

/**
 * 创建优化的事件监听器
 */
export function createOptimizedEventListener(
  element: EventTarget,
  event: string,
  handler: EventListener,
  options: {
    passive?: boolean
    capture?: boolean
    once?: boolean
    throttle?: number
    debounce?: number
  } = {}
): () => void {
  let optimizedHandler = handler

  // 应用节流
  if (options.throttle) {
    optimizedHandler = throttle(handler as any, options.throttle) as EventListener
  }

  // 应用防抖
  if (options.debounce) {
    optimizedHandler = debounce(handler as any, options.debounce) as EventListener
  }

  const listenerOptions: AddEventListenerOptions = {
    passive: options.passive,
    capture: options.capture,
    once: options.once
  }

  element.addEventListener(event, optimizedHandler, listenerOptions)

  return () => {
    element.removeEventListener(event, optimizedHandler, listenerOptions)
  }
}