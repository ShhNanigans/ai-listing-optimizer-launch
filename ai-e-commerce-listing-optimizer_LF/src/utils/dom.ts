/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// DOM Utility Functions for Performance Optimization

const documentFragment = document.createDocumentFragment();

export const createElement = <K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  options?: {
    className?: string;
    textContent?: string;
    innerHTML?: string;
    attributes?: Record<string, string>;
  }
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tagName);
  
  if (options) {
    if (options.className) element.className = options.className;
    if (options.textContent) element.textContent = options.textContent;
    if (options.innerHTML) element.innerHTML = options.innerHTML;
    if (options.attributes) {
      Object.entries(options.attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
    }
  }
  
  return element;
};

export const appendChildren = (parent: Element, children: (Element | string)[]): void => {
  const fragment = document.createDocumentFragment();
  children.forEach(child => {
    if (typeof child === 'string') {
      fragment.appendChild(document.createTextNode(child));
    } else {
      fragment.appendChild(child);
    }
  });
  parent.appendChild(fragment);
};

export const setButtonLoading = (
  button: HTMLButtonElement, 
  isLoading: boolean, 
  defaultText: string
): void => {
  button.disabled = isLoading;
  const textEl = button.querySelector('.btn-text') as HTMLElement;
  
  if (isLoading) {
    textEl.textContent = 'Generating...';
    if (!button.querySelector('.loader')) {
      const loader = createElement('div', { className: 'loader' });
      button.prepend(loader);
    }
  } else {
    textEl.textContent = defaultText;
    button.querySelector('.loader')?.remove();
  }
};

export const displayError = (message: string): void => {
  const resultsContainer = document.getElementById('results-container');
  if (resultsContainer) {
    resultsContainer.innerHTML = `<div class="error-message">${message}</div>`;
  }
};

// Debounced function for performance
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void => {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  };
};

// Optimized template creation with caching
const templateCache = new Map<string, HTMLTemplateElement>();

export const createTemplate = (html: string): DocumentFragment => {
  if (!templateCache.has(html)) {
    const template = createElement('template');
    template.innerHTML = html.trim();
    templateCache.set(html, template);
  }
  
  const template = templateCache.get(html)!;
  return document.importNode(template.content, true);
};

// Intersection Observer for lazy loading
export const createIntersectionObserver = (
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit
): IntersectionObserver => {
  return new IntersectionObserver(callback, {
    rootMargin: '50px',
    threshold: 0.1,
    ...options
  });
};

// Performance-optimized event delegation
export const delegateEvent = (
  container: Element,
  selector: string,
  eventType: string,
  handler: (event: Event, target: Element) => void
): void => {
  container.addEventListener(eventType, (event) => {
    const target = (event.target as Element).closest(selector);
    if (target) {
      handler(event, target);
    }
  });
};