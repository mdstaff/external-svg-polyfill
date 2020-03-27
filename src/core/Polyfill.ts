import Options from './Options';

export default class Polyfill {
	private parser: HTMLAnchorElement;
	private observer: MutationObserver;
	private process: boolean;
	private cache: {
		files: Map<string, HTMLElement|null>;
		elements: Map<SVGUseElement, string>;
	};

	private defaults: Options = {
		target: 'svg use',
		context: window.document.body || window.document.documentElement,
		root: window.document.body || window.document.documentElement,
		crossdomain: true,
		namespace: 'external-svg-polyfill',
		agents: [
			/msie|trident/i,
			/edge\/12/i,
			/ucbrowser\/11/i,
		],
	};

	public constructor() {
		this.cache = {
			files: new Map(),
			elements: new Map(),
		};

		this.observer = new MutationObserver(this.updateElements.bind(this));
		this.parser = window.document.createElement('a');

		this.process = this.detect();
    this.updateElements();
		this.observe();
	}

	public detect(): boolean {
		return this.defaults.agents.some((agent: RegExp) => agent.test(window.navigator.userAgent));
	}

	public observe(): void {
		this.observer.observe(this.defaults.context, {
			childList: true,
			subtree: true,
		});
	}

	public unobserve(): void {
		this.observer.disconnect();
	}

	public destroy(): void {
		this.unobserve();

		this.cache.elements.forEach((value, element) => {
			this.dispatchEvent(element, 'revoke', { value }, () => {
				this.renderFrame(() => {
					this.setLinkAttribute(element, value);
					this.cache.elements.delete(element);
				});
			});
		});

		this.cache.files.forEach((file, address) => {
			file && this.dispatchEvent(file, 'remove', { address }, () => {
				this.renderFrame(() => this.defaults.root.removeChild(file));
				this.cache.files.delete(address);
			});
		});
	}

	private updateElements(): void {
		const elements = typeof this.defaults.target === 'string'
			? [].slice.call(this.defaults.context.querySelectorAll(this.defaults.target))
			: this.defaults.target;

		Array.from(elements).forEach(this.processElement.bind(this));
	}

	private processElement(element: SVGUseElement): void {
		const value = element.getAttribute('href') || element.getAttribute('xlink:href');

		if (value && !value.startsWith('#') && !this.cache.elements.has(element)) {
			this.parser.href = value;

			if (this.process || (this.defaults.crossdomain && window.location.origin !== this.parser.origin)) {
				const address = this.parser.href.split('#')[0];
				const identifier = this.generateIdentifier(this.parser.hash);

				if (address && !this.cache.files.has(address)) {
					this.dispatchEvent(element, 'load', { address }, () => {
						this.cache.files.set(address, null);
						this.loadFile(address);
					});
				}

				this.dispatchEvent(element, 'apply', { address, identifier }, () => {
					this.renderFrame(() => {
						this.setLinkAttribute(element, `#${identifier}`);
						this.cache.elements.set(element, value);
					});
				});
			}
		}
	}

	private loadFile(address: string): void {
		const loader = new XMLHttpRequest();
		loader.addEventListener('load', (event: Event) => this.onFileLoaded.call(this, event, address));
		loader.open('get', address);
		loader.responseType = 'document';
		loader.send();
	}

	private generateIdentifier(identifier: string): string {
		identifier = identifier.replace('#', '');
		return identifier;
	}

	private dispatchEvent(element: Element, name: string, detail?: any, callback?: Function): void {
		const event = window.document.createEvent('CustomEvent');
		event.initCustomEvent(`${this.defaults.namespace}.${name}`, true, true, detail);

		element.dispatchEvent(event);

		if (!event.defaultPrevented && callback) {
			callback();
		}
	}

	private renderFrame(callback: FrameRequestCallback): void {
		window.requestAnimationFrame(callback.bind(this));
	}

	private setLinkAttribute(element: SVGUseElement, value: string): void {
		element.hasAttribute('href') && element.setAttribute('href', value);
		element.hasAttribute('xlink:href') && element.setAttribute('xlink:href', value);
	}

	private onFileLoaded(event: Event, address: string): void {
		const file = (event.target as XMLHttpRequest).response.documentElement;
		file.setAttribute('aria-hidden', 'true');
		file.style.position = 'absolute';
		file.style.overflow = 'hidden';
		file.style.width = 0;
		file.style.height = 0;

		this.cache.files.set(address, file);

		this.dispatchEvent(this.defaults.root, 'insert', { address, file }, () => {
			this.renderFrame(() => {
				this.defaults.root.insertAdjacentElement('afterbegin', file);
			});
		});
	}
}
