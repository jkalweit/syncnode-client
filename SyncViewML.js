"use strict"


class SyncViewML {


		static isCapitalized(str) { return str[0] === str[0].toUpperCase(); } 

		static numTabs(str) {
				var count = 0;
				for(var i = 0; i < str.length; i++) {
						if(str[i] === '\t') { count++; }
						else return count;
				}
				return count;
		}

		static getName(str) { 
				var result = /(\w*)/.exec(str);
				if(result) return result[1];
				else return '';
		}
		static getBinding(str) { 
				var result = /\$[(](.*?)[)]/.exec(str);
				if(result) return result[1];
				else return '';
		}

		static getId(str) { 
				var result = /[#](\w*)/.exec(str);
				if(result) return result[1];
				else return '';
		}
		static getTag(str) { 
				var result = /[:](\w*)/.exec(str);
				if(result) return result[1];
				else return '';
		}
		static getBetween(str, startDelimiter, endDelimiter) {
				endDelimiter = endDelimiter || startDelimiter;
				var exp = `[${startDelimiter}](.*?)[${endDelimiter}]`;
				return new RegExp(exp).exec(str);
		}
		static getText(str) { 
				var result = SyncViewML.getBetween(str, '\'');
				if(result) return result[1];
				else return '';
		}
		static getClasses(str) { 
				var result = SyncViewML.getBetween(str, '\\[', '\\]');
				if(result) return result[1];
				else return '';
		}

		static getProp(str) { 
				var result = /(\w*)[:]/.exec(str);
				if(result) return result[1].trim();
				else return '';
		}
		static getCode(str) { 
				var result = /[:](.*?)/.exec(str);
				if(result) return result[1];
				else return '';
		}

		static getArgs(str) { 
				var result = SyncViewML.getBetween(str, '(', ')');
				if(result) { 
						var args = result[1].split(',');
						return args.map((arg) => { return arg.trim(); });
				}
				else return [];
		}

		static getOptions(str) { 
				var exp = /[^$][\(](.*?)[\)]/;
				var result = new RegExp(exp).exec(str);
				if(result) { 
						return eval('(' + result[1] + ')');
				}
				else return {};
		}



		static findComponents(lines) {
				var currComponent;
				var inComponent = false;
				for(var i = 0; i < lines.length; i++) {
						var line = lines[i];
						var trimmed = line.trim();
						if(trimmed !== '') {
								var tabs = SyncViewML.numTabs(line);
								if(tabs === 0 && trimmed[0] !== '#') {
										inComponent = true;
										var componentName = SyncViewML.getName(line);
										var classes = SyncViewML.getClasses(line);
										currComponent = {
name: componentName,
	  classes: classes,
	  ctor: new Function(`
					  this.node = SV.el('div');
					  this.eventHandlers = {};
					  this.bindings = {};
					  `),
	  code: ''
										};

										currComponent.ctor.prototype = Object.create(SyncView.prototype);
										this.components[componentName] = currComponent;
								}
								else if(tabs !== 0 && inComponent) {
										currComponent.code += line + '\n';
								} else {
										inComponent = false;
								}
						}
				}
		}

		static importCode(id) {
				var code = document.getElementById(id).import.children[0].innerText;
				SyncViewML.parse(code);
		}

		static parse(code, container) {

				SyncViewML.components = SyncViewML.components || {};

				container = container || document.body;

				var lines = code.split('\n'); 

				SyncViewML.findComponents(lines);

				var componentInstance;
				var el;
				for(var i = 0; i < lines.length; i++) {
						var line = lines[i];
						var trimmed = line.trim();
						if(trimmed !== '') {
								var tabs = SyncViewML.numTabs(line);
								var addToContainer = true;
								if(tabs === 0 && trimmed[0] === '!') {
										addToContainer = false;
										trimmed = trimmed.substr(1);	
								}
								if(tabs === 0 && trimmed[0] === '#') {
										var id = SyncViewML.getId(trimmed);
										var componentName = SyncViewML.getTag(trimmed);
										var classes = SyncViewML.getClasses(trimmed);
										componentInstance = SyncViewML.buildComponent(componentName, SyncViewML.getOptions(trimmed));
										componentInstance.node.className += ' ' + classes;
										if(addToContainer) {
												container.appendChild(componentInstance.node);
										}
										window[id] = componentInstance;
								}			
						}
				}

		}


		static buildComponent(componentName, options) {


				if(typeof componentName === 'function') {
						//args.unshift(null);
						var instance = new (Function.prototype.bind.call(componentName, this, options));
						return instance;
				}


				var component = this.components[componentName]; 

				if(!component) {
						var ctor = window[componentName];
						//args.unshift(null);
						if(!ctor) {
								console.error('Cannot find component:', componentName);
						}
						var instance = new (Function.prototype.bind.call(ctor, this, options));
						if(instance.init) instance.init();
						return instance;
				}


				var componentInstance = new component.ctor();
				componentInstance.node.className += ' ' + component.classes;
				var lines = component.code.split('\n');
				var el;
				for(var i = 0; i < lines.length; i++) {
						var line = lines[i];
						var trimmed = line.trim();
						if(trimmed !== '' && trimmed[0] !== '/' && trimmed[1] !== '/') { // ignore commented lines
								var tabs = SyncViewML.numTabs(line);
								if(tabs === 1) {
										var id = SyncViewML.getId(trimmed);
										var binding = SyncViewML.getBinding(trimmed);
										var tag = SyncViewML.getTag(trimmed) || 'div';
										var classes = SyncViewML.getClasses(trimmed);
										var inner = SyncViewML.getText(trimmed);
										var displayName = componentName + ':' + id + ':' + tag; // for debugger	
										if(binding) { 
												var split = binding.split('=');
												var prop = 'innerHTML';
												var value = split[0];
												if(split.length > 1) {
														prop = split[0]; 
														value = split[1];
												}
												var existing = componentInstance.bindings[id] || {};
												existing[prop] = value;
												componentInstance.bindings[id] = existing;
										}

										if(SyncViewML.isCapitalized(tag)) {
												var options2 = SyncViewML.getOptions(trimmed);
												el = SyncViewML.buildComponent(tag, options2);
												if(classes) el.node.className += ' ' + classes;
												if(id) el.node.id = id;
												componentInstance.node.appendChild(el.node);
										} else if(tag === 'function') {
												var args2 = SyncViewML.getArgs(trimmed);
												var code = SyncViewML.getCode(trimmed).substr(trimmed.indexOf('function') +3,trimmed.length);
												while(i+1 < lines.length && SyncViewML.numTabs(lines[i+1]) > 1) {
														i = i+1;
														code += lines[i] + '\n';
												}
												el = new Function(args2, code).bind(componentInstance);
												Object.defineProperty(el, 'name', { value: displayName });
												el.displayName = displayName;
												//if(id === 'init') console.log('code', id, args, code);
										} else if(tag === 'events') {
												var code = SyncViewML.getCode(trimmed);
												while(i+1 < lines.length && SyncViewML.numTabs(lines[i+1]) > 1) {
														i = i+1;
														code += lines[i] + '\n';
												}
												SyncViewML.parseEvents(code, componentInstance.node, componentInstance, 1, displayName);

										} else if(tag === 'style') {
												var style = SyncViewML.getCode(trimmed);
												while(i+1 < lines.length && SyncViewML.numTabs(lines[i+1]) > 1) {
														i = i+1;
														style += lines[i] + '\n';
												}
												style.replace('\n', ' ');
												var styleArr = style.split(';');
												styleArr.forEach((item) => {
																if(item === '') return;
																var pair = item.split(':');
																pair = pair.map((s) => s.trim());
																componentInstance.node.style[pair[0]] = pair[1];
																});
										} else {

												el = SV.el(tag, { 
parent: componentInstance.node,
id: id, 
className: classes, 
innerHTML: inner 
});
}

if(id) componentInstance[id] = el;
} else if(tabs === 2) {
		var prop = SyncViewML.getProp(trimmed);
		if(prop === 'style') {
				var style = SyncViewML.getCode(trimmed);
				while(i+1 < lines.length && SyncViewML.numTabs(lines[i+1]) > 2) {
						i = i+1;
						style += lines[i] + '\n';
				}

				style.replace('\n', ' ');
				var styleArr = style.split(';');
				var styleObj = SyncView.isSyncView(el) ? el.node.style : el.style;
				if(!styleObj && el.node) styleObj = el.node.style;
				styleArr.forEach((item) => {
								if(item === '') return;
								var pair = item.split(':');
								pair = pair.map((s) => s.trim());
								styleObj[pair[0]] = pair[1];
								});
		} else if(prop === 'events') {
				var code = SyncViewML.getCode(trimmed);
				while(i+1 < lines.length && SyncViewML.numTabs(lines[i+1]) > 2) {
						i = i+1;
						code += lines[i] + '\n';
				}
				SyncViewML.parseEvents(code, el, componentInstance, 2, displayName);	
		} else if(prop === 'attributes') {
				var attr = SyncViewML.getCode(trimmed);
				while(i+1 < lines.length && SyncViewML.numTabs(lines[i+1]) > 2) {
						i = i+1;
						attr += lines[i] + '\n';
				}
				attr.replace('\n', ' ');
				var attrArr = attr.split(';');
				attrArr.forEach((item) => {
								if(item.trim() === '') return;
								var pair = item.split(':');
								pair = pair.map((s) => s.trim());
								el.setAttribute(pair[0], pair[1]);
								});
		}
}			
}
}

if(componentInstance.init) componentInstance.init.call(componentInstance, options);

return componentInstance;
}

static parseEvents(code, el, context, tabsBase, displayName) {
		context = context || el;
		var lines = code.split('\n');
		for(var i = 0; i < lines.length; i++) {
				var line = lines[i];
				var trimmed = line.trim();
				if(trimmed !== '') {
						var tabs = SyncViewML.numTabs(line);
						if(tabs === tabsBase+1) {
								var name = SyncViewML.getName(trimmed);
								var args = SyncViewML.getArgs(trimmed);
								var code = SyncViewML.getCode(trimmed);
								while(i+1 < lines.length && SyncViewML.numTabs(lines[i+1]) > tabsBase+1) {
										i = i+1;
										code += lines[i] + '\n';
								}
								var fn = new Function(args, code).bind(context);
								Object.defineProperty(fn, 'name', { value: displayName });
								fn.displayName = displayName;
								if(el.on) {
										el.on(name, fn);
								} else {
										el.addEventListener(name, fn);
								}
						}
				}
		}
}
}




class List extends SyncView {
		constructor(options) {
				super();
				this.views = {};
				this.ctor = options.ctor;
				this.sort = options.sort;
				this.sortDirection = options.direction;
		}
		render() {
				var data = this.data || {};
				var itemsArr = SV.toArray(data, this.sort, this.sortDirection);
				var previous = null;
				itemsArr.forEach((item) => {
								var view  = this.views[item.key];
								if(!view) {
								view = SyncViewML.buildComponent(this.ctor);
								this.views[item.key] = view;
								view.update(item);
								this.emit('viewAdded', view);
								} else {
								view.update(item);
								}
								// Attempt to preserve order
								this.node.insertBefore(view.node, previous ? previous.node.nextSibling : this.node.firstChild);
								previous = view;
								});
				Object.keys(this.views).forEach((key) => {
								var view = this.views[key];
								if(!SV.getByKey(data, view.data.key)) {
								this.node.removeChild(view.node);
								delete this.views[view.data.key];
								this.emit('removedView', view);
								}
								});
		}
}




class Input extends SyncView {
	constructor(options) {
		super();

		this.node.className = 'label-set col-nofill';
		options = options || {};
		this.options = options;


		this.doFlash = true;
		
		if(options.label) {
			SV.el('span', { parent: this.node, innerHTML: this.options.label, className: 'label' });
		}

		if(options.number) {
			this.options.validator = this.options.validator || Input.NumberValidator;
			this.options.parser = this.options.parser || Input.NumberParser;
			this.options.formatter = this.options.formatter || SV.formatCurrency;
		}

		var elem = this.options.isTextArea ? 'textarea' : 'input';
		this.input = SV.el(elem, { parent: this.node,
			events: { 
				focus: () => {
					this.input.select();
				},
				blur: () => {
					var value = this.input.value;			
					if(this.options.validator) {
							if(!this.options.validator(value)) {
								alert('Invalid value: "' + value + '"');
								return;
							}
					}

					if(this.options.parser) { 
							value = this.options.parser(value);
							if(this.input.value !== value) {
								this.input.value = this.options.formatter ? this.options.formatter(value) : value; 
							}
					}
					if(this.data && this.data[this.options.prop] !== value) {
						var oldValue = this.data[this.options.prop];
						this.data.set(this.options.prop, value);
						this.emit('changed', value, oldValue);
					}
				}
			}});
		if(options.number) this.input.style.textAlign = 'right';
		if(options.datalist) this.input.setAttribute('list', options.datalist);
	}
	focus() {
		this.input.focus();
	}
	render() {
		if(this.data && this.input.value !== this.data[this.options.prop]) {
			var val = this.data[this.options.prop] || '';
			this.input.value = this.options.formatter ? this.options.formatter(val) : val; 
		}
	}

	static NumberValidator(val) {
		if(typeof val === 'number') return true;
		if(val.trim() == '') return true;
		val = val.replace('$', '');
		return !isNaN(parseFloat(val));
	}
	static NumberParser(val) {
		if(typeof val === 'number') return val;
		if(val.trim() == '') return 0;
		val = val.replace(',', '');
		val = val.replace('$', '');
		return parseFloat(val);
	}

	static DateValidator(val) {
		if(val.trim() == '') return true;
		return moment(val, 'MM/DD/YYYY hh:mma').isValid(); 
	}
	static DateParser(val) {
		if(val.trim() == '') return null;
		console.log('value here', val);
		return moment(val, 'MM/DD/YYYY hh:mma').toISOString();
	}
}

