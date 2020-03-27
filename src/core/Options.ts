export default interface Options {
	target: string|SVGUseElement[]|NodeListOf<SVGUseElement>;
	context: HTMLElement;
	root: HTMLElement;
	crossdomain: boolean;
	namespace: string;
	agents: RegExp[];
}
