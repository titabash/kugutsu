/**
 * React Flow モック
 *
 * React FlowのJestテストに必要なブラウザAPIのモック
 * 公式ドキュメント: https://reactflow.dev/learn/advanced-use/testing
 */

export function mockReactFlow() {
  let init = false;

  if (init) {
    return;
  }

  init = true;

  // ResizeObserver のモック
  global.ResizeObserver = class ResizeObserver {
    callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element) {
      this.callback([{ target } as ResizeObserverEntry], this);
    }

    unobserve() {
      // do nothing
    }

    disconnect() {
      // do nothing
    }
  };

  // DOMMatrixReadOnly のモック
  global.DOMMatrixReadOnly = class DOMMatrixReadOnly {
    m22: number;

    constructor(transform: string) {
      const scale = transform?.match(/scale\(([1-9.])\)/)?.[1];
      this.m22 = scale !== undefined ? parseFloat(scale) : 1;
    }
  } as any;

  // HTMLElement のプロパティをモック
  Object.defineProperties(global.HTMLElement.prototype, {
    offsetHeight: {
      get() {
        return parseFloat(this.style.height) || 1;
      },
    },
    offsetWidth: {
      get() {
        return parseFloat(this.style.width) || 1;
      },
    },
  });

  // SVGElement.getBBox のモック
  (global.SVGElement as any).prototype.getBBox = () => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
}
