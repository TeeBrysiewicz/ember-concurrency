export const cancelableSymbol = "__ec_cancel__";
export const yieldableSymbol = "__ec_yieldable__";
export const YIELDABLE_CONTINUE = "next";
export const YIELDABLE_THROW = "throw";
export const YIELDABLE_RETURN = "return";
export const YIELDABLE_CANCEL = "cancel";

export class Yieldable {
  constructor() {
    this[yieldableSymbol] = this[yieldableSymbol].bind(this);
    this[cancelableSymbol] = this[cancelableSymbol].bind(this);
  }

  _deferable() {
    let def = { resolve: undefined, reject: undefined };

    def.promise = new Promise((resolve, reject) => {
      def.resolve = resolve;
      def.reject = reject;
    });

    return def;
  }

  _toPromise() {
    let def = this._deferable();

    let thinInstance = {
      proceed(_index, resumeType, value) {
        if (resumeType == YIELDABLE_CONTINUE || resumeType == YIELDABLE_RETURN) {
          def.resolve(value);
        } else {
          def.reject(value);
        }
      }
    };

    let maybeDisposer = this[yieldableSymbol](thinInstance, 0);
    def.promise[cancelableSymbol] = maybeDisposer || this[cancelableSymbol];

    return def.promise;
  }

  then(...args) {
    return this._toPromise().then(...args);
  }

  catch(...args) {
    return this._toPromise().catch(...args);
  }

  finally(...args) {
    return this._toPromise().finally(...args);
  }

  [yieldableSymbol]() {}
  [cancelableSymbol]() {}
}

class ForeverYieldable extends Yieldable {
  [yieldableSymbol]() {}
  [cancelableSymbol]() {}
}

class RawTimeoutYieldable extends Yieldable {
  constructor(ms) {
    super();
    this.ms = ms;
    this.timerId = null;
  }

  [yieldableSymbol](taskInstance, resumeIndex) {
    this.timerId = setTimeout(() => {
      taskInstance.proceed(resumeIndex, YIELDABLE_CONTINUE, taskInstance._result);
    }, this.ms);
  }

  [cancelableSymbol]() {
    clearTimeout(this.timerId);
    this.timerId = null;
  }
}

/**
 *
 * Yielding `forever` will pause a task indefinitely until
 * it is cancelled (i.e. via host object destruction, .restartable(),
 * or manual cancellation).
 *
 * This is often useful in cases involving animation: if you're
 * using Liquid Fire, or some other animation scheme, sometimes you'll
 * notice buttons visibly reverting to their inactive states during
 * a route transition. By yielding `forever` in a Component task that drives a
 * button's active state, you can keep a task indefinitely running
 * until the animation runs to completion.
 *
 * NOTE: Liquid Fire also includes a useful `waitUntilIdle()` method
 * on the `liquid-fire-transitions` service that you can use in a lot
 * of these cases, but it won't cover cases of asynchrony that are
 * unrelated to animation, in which case `forever` might be better suited
 * to your needs.
 *
 * ```js
 * import { task, forever } from 'ember-concurrency';
 *
 * export default Component.extend({
 *   myService: service(),
 *   myTask: task(function * () {
 *     yield this.myService.doSomethingThatCausesATransition();
 *     yield forever;
 *   })
 * });
 * ```
 */
export const forever = new ForeverYieldable();

export class RawValue {
  constructor(value) {
    this.value = value;
  }
}

export function raw(value) {
  return new RawValue(value);
}

/**
 *
 * Yielding `rawTimeout(ms)` will pause a task for the duration
 * of time passed in, in milliseconds.
 *
 * The timeout will use the native `setTimeout()` browser API,
 * instead of the Ember runloop, which means that test helpers
 * will *not* wait for it to complete.
 *
 * The task below, when performed, will print a message to the
 * console every second.
 *
 * ```js
 * export default Component.extend({
 *   myTask: task(function * () {
 *     while (true) {
 *       console.log("Hello!");
 *       yield rawTimeout(1000);
 *     }
 *   })
 * });
 * ```
 *
 * @param {number} ms - the amount of time to sleep before resuming
 *   the task, in milliseconds
 */
export function rawTimeout(ms) {
  return new RawTimeoutYieldable(ms);
}