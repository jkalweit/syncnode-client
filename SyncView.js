"use strict"




class SyncView {
	constructor(content) {
		if(content instanceof HTMLElement) {
			this.node = content;
		} else {
			this.node = SV.el('div', { innerHTML: content || ''});
		}
		this.eventHandlers = {};
		this.bindings = {};
	}
	appendView(syncview, parent) {
		(parent || this.node).appendChild(syncview.node);
		return syncview;
	}
	static updateViews(views, data) {
		views.forEach(view => { view.update(data); });
	}
	update(data, force) {
		if(force || this.hasChanged(data)) {
			//this.lastModified = data.lastModified;
			this.currentVersion = data ? data.version : null;
			//var oldData = this.data;
			this.data = data;
			this.emit('updating', data); //, oldData);
			this.bind();
			if(this.render) this.render(force);
			if(this.doFlash) this.flash(); 
		}
		else {
			if(this.name) console.log(this.name + ' DATA NO CHANGED', this, this.data, data);
		}
	}
	bind() {

		function traverse(curr, pathArr) {
			if(pathArr.length === 0) return curr;	
			else {
				var next = pathArr.shift();
				if(curr == null || !curr.hasOwnProperty(next)) return null;
				return traverse(curr[next], pathArr);  
			}
		}

		Object.keys(this.bindings).forEach((id) => { 
			var props = this.bindings[id];
			Object.keys(props).forEach((prop) => { 
				var valuePath = props[prop];
				var value = traverse(this, valuePath.split('.'));
				if(prop === 'update') {
					this[id].update(value);
				} else {
					this[id][prop] = value;
				}
			});
		});	
	}
	hasChanged(newData) {

		// if(this.name) console.log(this.name + ' doing hasChanged #########################');
		if(!this.data && !newData) {
		 	if(this.name) console.log(this.name + 'here1 both are null');
		 	return false;
		}
		if((this.data && !newData) || (!this.data && newData)) { 
		// 	if(this.name) console.log(this.name + 'here2');
		 	return true;
		}

		if(this.currentVersion && newData.version) {
			//console.log('checking version #################', this.currentVersion, newData.version);
			return this.currentVersion !== newData.version;
		}


//		console.log('defaulting to true #################', this.data !== newData, this.currentVersion, newData);
		return true;
		
		// if((typeof this.data !== 'object') && (typeof newData !== 'object')) {
		// 	console.log('direct comparison', this.data, newData);
		// 	return this.data === newData;
		// }
		// if(!this.data.lastModified || !newData.lastModified) {
		// 	if(this.name) console.log(this.name + 'here3');
		// 	return true;
		// }	
		// if(this.name) console.log(this.name + 'here4', this.lastModified, newData.lastModified);
		// if(this.name) console.log(this.name + 'here5', this.currentVersion, newData.version);
		// return (this.data.version !== newData.version) || (this.currentVersion != newData.version);
		// return this.lastModified !== newData.lastModified;
	}
	on(eventName, handler) {
		if(!this.eventHandlers[eventName]) this.eventHandlers[eventName] = [];
		this.eventHandlers[eventName].push(handler);
	}
	emit(eventName) {
		var handlers = this.eventHandlers[eventName] || [];
		var args = new Array(arguments.length-1);
		for(var i = 1; i < arguments.length; ++i) {
			args[i-1] = arguments[i];
		}
		handlers.forEach(handler => { handler.apply(null, args); });
	}
	flash() {
		// to visualize changes for debugging
		SV.flash(this.node);
	}
	static isSyncView(val) {
		if(!SyncNode.isObject(val)) return false;
		var className = val.constructor.toString().match(/\w+/g)[1];
 		return className === 'SyncView';
	}
}





class SV {
	static id(id, context) {
		context = context || document;
		return context.getElementById(id);
	}
	static getProperty(obj, path) {
		if(!path) return obj;
		return SV.getPropertyHelper(obj, path.split('.'));
	}

	static getPropertyHelper(obj, split) {
		if(split.length === 1) return obj[split[0]];
		if(obj == null) return null;
		return SV.getPropertyHelper(obj[split[0]], split.slice(1, split.length));
	}

	static inject(template, data) {
		template = template.replace(/checked="{{([\w\.]*)}}"/g, function(m, key) {
			return SV.getProperty(data, key) ? 'checked' : '';
		});

		return template.replace(/{{([\w\.]*)}}/g, function(m, key) {
			return SV.getProperty(data, key);
		});
	}
	static mergeMap(source, destination) {
		Object.keys(source).forEach((key) => {
			destination[key] = source[key];
		});
	}

	static normalize(str) {
		return (str || '').trim().toLowerCase();
	}

	static generateCode(length) {
		var code = '';
		var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
		for(var i = 0; i < length; i++) {
			code += chars[Math.floor(Math.random() * chars.length)];
		}
		return code;
	}

	static createElement(name) {
		var proto = Object.create(HTMLElement.prototype);
		proto.template = id(name);
		var ctor = document.registerElement(name, {
			prototype: proto
		});

		return function(data) {
			var element = new ctor();
			element.data = data;
			return element;
		};
	}

	static toMap(arr, keyValFunc) {
		keyValFunc = keyValFunc || ((obj) => { return obj.key });
		if(typeof arr !== 'array') return arr;
		var result = {};
		var curr;
		for(var i = 0; i < arr.length; i++) {
			curr = arr[i];	
			result[keyValFunc(curr)] = curr;	
		}
		return result;
	}

	static sortMap(obj, sortField, reverse, keyValFunc) {
		return SV.toMap(SV.toArray(obj, sortField, reverse), keyValFunc);
	}

	static toArray(obj, sortField, reverse) {
		var result;
		if(Array.isArray(obj)) {
			result = obj.slice();
		} else {
			result = [];
			if(!obj) return result;
			Object.keys(obj).forEach((key) => {
				if (key !== 'version' && key !== 'lastModified' && key !== 'key') {
					result.push(obj[key]);
				}
			});
		}

		if(sortField) {
			var getSortValue;
			if(typeof sortField === 'function') getSortValue = sortField;
			else getSortValue = (obj) => { return SV.getProperty(obj, sortField); }
			result.sort(function (a, b) {
				var a1 = getSortValue(a);
				var b1 = getSortValue(b);
				if(typeof a1 === 'string') a1 = a1.toLowerCase();
				if(typeof b1 === 'string') b1 = b1.toLowerCase();
				if (a1 < b1)
					return reverse ? 1 : -1;
				if (a1 > b1)
					return reverse ? -1 : 1;
				return 0;
			});
		}
		return result;
	}

	static forEach(obj, func) {
		if(typeof obj !== 'array') {
			obj = SV.toArray(obj);
		}
		obj.forEach(val => func(val));
	}

	static getByKey(obj, key) {
		if(Array.isArray(obj)) {
			for(var i = 0; i < obj.length; i++) {
				if(obj[i].key === key) return obj[i];
			}
		} else {
			return obj[key]; 
		}
	}

	static findFirst(obj, func) {
		var arr = SV.toArray(obj);
		var curr;
		for(var i = 0; i < arr.length; i++) {
			curr = arr[i]; 
			if(func(curr)) return curr;
		}
		return null;
	}


	// for debugging, receive reload signals from server when source files change
	static startReloader() {
		io().on('reload', function() {
			console.log('               reload!!!!');
			location.reload();
		});
	}


	static param(variable) {
		var query = window.location.search.substring(1);
		var vars = query.split("&");
		for (var i = 0; i < vars.length; i++) {
			var pair = vars[i].split("=");
			if (pair[0] == variable) {
				return pair[1];
			}
		}
		return (false);
	}

	static updateViews(parent, views, ctor, items, itemsArr) {
		itemsArr = itemsArr || SV.toArray(items);
		itemsArr.forEach((item) => {
			var view  = views[item.key];
			if(!view) {
				view = new ctor();
				views[item.key] = view;
				parent.appendChild(view.node);
			}
			view.update(item);
		});
		Object.keys(views).forEach((key) => {
			var view = views[key];
			if(!items[view.data.key]) {
				parent.removeChild(view.node);
				delete views[view.data.key];
			}
		});
	}

	static el(name, opts) {
		opts = opts || {};
		var elem = document.createElement(name);
		Object.keys(opts).forEach((key) => {
			if(key !== 'events' && key !== 'style' && key !== 'attributes') {
				elem[key] = opts[key];
			}
		});
		if(opts.events) {
			Object.keys(opts.events).forEach((key) => {
				elem.addEventListener(key, opts.events[key]);
			});
		}
		if(opts.style) {
			Object.keys(opts.style).forEach((key) => {
				elem.style[key] = opts.style[key];
			});
		}
		if(opts.attributes) {
			Object.keys(opts.attributes).forEach((key) => {
				elem.setAttribute(key) = opts.attributes[key];
			});
		}
		if(opts.parent) opts.parent.appendChild(elem);
		return elem;
	}
	
	static onLoad(callback) {
		window.addEventListener('load', (e) => {
			callback(e);
		});
	}

	static group(arr, prop, groupVals) {
		var groups = {};

		if(typeof groupVals === 'array') {
			groupVals.forEach((groupVal) => {
				groups[groupVal] = { key: groupVal };
			});
		}


		if(!Array.isArray(arr)) arr = SV.toArray(arr);

		arr.forEach(function (item) {
			var val;
			if(typeof prop === 'function') {
				val = prop(item);
			} else {
				val = item[prop];
			}

			if(!groups[val]) groups[val] = { key: val };
			groups[val][item.key] = item;
		});

		return groups;
	}

	static getDayOfWeek(day, mdate) {
		mdate = mdate || moment();
		var sunday = mdate.startOf('day').subtract(mdate.day(), 'day');
		return sunday.add(day, 'day');
	}

	static filterMap(map, filterFn) {
		var result = {};
		map = map || {};
		Object.keys(map).forEach(key => {
			if(key !== 'version' && key !== 'key' && key !== 'lastModified' && filterFn(map[key])) {
				result[key] = map[key];
			}
		});
		return result;
	}

  	static arrayContains(list, value) {
      		for (var i = 0; i < list.length; ++i) {
          		if (list[i] === value)
              		return true;
      		}
      		return false;
  	}

	static flash(elem) {
		elem.classList.add('flash');
		setTimeout(() => { elem.classList.remove('flash'); }, 500);
	}

	static removeCrap(doc) {
		if(typeof doc !== 'object') return doc;
		console.log('doc', doc);
		Object.keys(doc).forEach((key) => {
			console.log('key', key);
			if(key === 'version' || key === 'key' || key === 'serveType' || key === 'modifiers' || key === 'addedAt' || key === 'addedBy' || key === 'isAlcohol' || key === 'taxType' || key === 'options') {
				console.log('deleting', key);
				delete doc[key];
			} else {
				console.log('continuuing', key);
				doc[key] = SV.removeCrap(doc[key]);
			}
		});
		return doc;
	}

	static normalizePhone(phone) {
		return phone.replace('-', '').replace('(', '').replace(')', '').replace('.', '').replace(' ', '').toLowerCase();
	}

	static formatCurrency(value, precision) {
		if(value === '') value = 0;
		precision = (typeof precision === 'number') ? precision : 2;
		var number = (typeof value === 'string') ? parseFloat(value) : value;
		if(value == null) {
			return '';
		}
		return SV.numberWithCommas(number.toFixed(precision).toString());
	}

	static formatTime(value) {
		if(!value) return '';
		return moment(value).format('h:mma');
	}
	
	static formatDate(value) {
		if(!value) return '';
		return moment(value).format('MM/DD/YYYY hh:mma');
	}
	
	static durationAsHours(start, stop) {
		if(!start || !stop) return '';
		var dur = moment.duration(moment(stop).diff(moment(start)));
		return Math.round(dur.asHours() * 100) / 100;
	}

	static numberWithCommas(n) {
	    var parts=n.toString().split(".");
	    return parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (parts[1] ? "." + parts[1] : "");
	}

	static round(value, precision) {
		return parseFloat(value.toFixed(precision || 2));
	}

	static iconButton(icon, options) {
		var button = SV.el('div', options);
		button.classList.add('btn');
		button.classList.add('btn-big');
		button.innerHTML = `<i class="material-icons">${icon}</i>` + button.innerHTML;
		return button;
	}

	static substr(str, char) {
		var pos = str.indexOf(char);
		if(pos !== -1) {
			return str.substr(0, pos);
		} else return str;
	}

	static isValidEmail(email) {
		var re = /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
		return re.test(email);
	}

	static isEmptyObject(obj) {
		return Object.keys(obj).length === 0;
	}
}






class ViewsContainer extends SyncView {
	constructor(ctor, sort, direction, element) {
		super(element);
		this.views = {};
		this.ctor = ctor;
		this.sort = sort;
		this.sortDirection = direction;
	}
	render(force) {
		var itemsArr = SV.toArray(this.data, this.sort, this.sortDirection);
		var previous = null;
		itemsArr.forEach((item) => {
			var view  = this.views[item.key];
			if(!view) {
				view = new this.ctor();
				this.views[item.key] = view;
				// Attempt to preserve order
				this.node.insertBefore(view.node, previous ? previous.node.nextSibling : this.node.firstChild);
				view.update(item, force);
				this.emit('viewAdded', view);
			} else {
				view.update(item, force);
			}
			previous = view;
		});
		Object.keys(this.views).forEach((key) => {
			var view = this.views[key];
			if(!SV.getByKey(this.data, view.data.key)) {
				this.node.removeChild(view.node);
				delete this.views[view.data.key];
				this.emit('removedView', view);
			}
		});
	}
}



class SimpleEditInput extends SyncView {
	constructor(prop, label, options) {
		super();

		this.node.className = 'label-set';
		this.options = options || {};

		this.doFlash = true;
		
		this.prop = prop;
		
		if(label) {
			SV.el('span', { parent: this.node, innerHTML: label, className: 'label' });
		}

		var elem = this.options.isTextArea ? 'textarea' : 'input';
		this.input = SV.el(elem, { parent: this.node,
			events: { 
				blur: () => {
					var value = this.input.value;			
					if(this.options.validator && !this.options.validator(value)) {
						alert('Invalid value: "' + value + '"');
						return;
					}				

					if(this.options.parser) value = this.options.parser(value);
					if(this.data[this.prop] !== value) {
						var oldValue = this.data[this.prop];
						//var update = {};
						//update[this.prop] = value;
						this.data.set(this.prop, value);
						this.emit('changed', value, oldValue);
					}
				}
			}});
	}
	focus() {
		this.input.focus();
	}
	render() {
		if(this.data && this.input.value !== this.data[this.prop]) {
			var val = this.data[this.prop] || '';
			this.input.value = this.options.formatter ? this.options.formatter(val) : val; 
		}
	}

	static NumberValidator(val) {
		if(typeof val === 'number') return true;
		if(val.trim() == '') return true;
		return !isNaN(parseFloat(val));
	}
	static NumberParser(val) {
		if(typeof val === 'number') return val;
		if(val.trim() == '') return 0;
		return parseFloat(val);
	}
}


class EditInput extends SyncView {
	constructor(display, prop, inputStyle, emptyText) {
		super();
		this.prop = prop;

		this.mainView = SV.el('div', { parent: this.node,
			events: { click: () => {
				this.isEditing = true;
				this.render();
				this.input.focus();
			} } });
		this.display = display;
		this.mainView.appendChild(this.display);

		this.editView = SV.el('div', { parent: this.node });
		this.input = SV.el('input', { parent: this.editView,
			events: { blur: () => {
				this.data.set(this.prop, this.input.value);
				this.isEditing = false;
				this.render();
			} } });
		SV.mergeMap(inputStyle || {}, this.input.style);
		//this.input.style.width = 'calc(100% - 50px)';
		this.emptyText = emptyText;
		this.isEditing = false;
	}
	render() {
		this.input.value = this.data[this.prop];
		this.mainView.style.display = !this.isEditing ? 'block' : 'none';
		this.editView.style.display = this.isEditing ? 'block' : 'none';
		this.display.innerHTML = this.data[this.prop] || this.emptyText || '';
	}
}

class SimpleEditCheckBox extends SyncView {
	constructor(prop, label) {
		super();
		this.prop = prop;

		this.editView = SV.el('div', { parent: this.node });
		if(label) {
			SV.el('span', { parent: this.editView, innerHTML: label, className: 'label',
				style: { display: 'inline-block', width: '150px' }});
		}
		this.input = SV.el('input', { parent: this.editView, type: 'checkbox',
			style: { fontSize: '2em' },
			events: { change: () => {
				var value = this.input.checked;			
				if(this.data[this.prop] !== value) {
					var oldValue = this.data[this.prop];
					this.data.set(this.prop, value);
					this.emit('changed', value, oldValue);
				}
			}}});
	}
	render() {
		if(this.data[this.prop]) {
			this.input.setAttribute('checked', true);
		} else {
			this.input.removeAttribute('checked');
		}
	}
}

class SimpleEditSelect extends SyncView {
	constructor(prop, label, validator, formatter, options) {
		super();
		this.doFlash = true;
		
		this.prop = prop;

		this.editView = SV.el('div', { parent: this.node });
		if(label) {
			SV.el('span', { parent: this.editView, innerHTML: label, className: 'label',
				style: { display: 'inline-block', width: '150px' }});
		}
		var width = label ? 'calc(100% - 150px)' : '100%';
		this.input = SV.el('select', { parent: this.editView,
			style: { width: width },
			events: { blur: () => {
				var value = this.input.value;			
				if(validator && !validator(value)) {
					alert('Invalid value: "' + value + '"');
					return;
				}				
				if(formatter) value = formatter(value);
				if(this.data[this.prop] !== value) {
					var oldValue = this.data[this.prop];
					//var update = {};
					//update[this.prop] = value;
					this.data.set(this.prop, value);
					this.emit('changed', value, oldValue);
				}
			}}});
		if(options) this.updateOptions(options);
	}
	focus() {
		this.input.focus();
	}
	updateOptions(options) {
		this.input.innerHTML = '';
		SV.toArray(options).forEach((option) => {
			SV.el('option', { parent: this.input, innerHTML: option });
		});
		if(this.data) this.input.value = this.data[this.prop] || '';
	}
	render() {
		if(this.input.value !== this.data[this.prop])
			this.input.value = this.data[this.prop] || '';
	}
}



class Modal extends SyncView {
	constructor() {
		super();
		this.node.className = 'modal';
		this.node.addEventListener('click', () => { this.hide(); });

		this.mainView = SV.el('div', { parent: this.node, className: 'main-view group',
	   		events: { click: (e) => { e.stopPropagation(); }}});
		this.isShown = false;
	}
	show() {
		if(this.isShown) return;
		this.isShown = true;
		this.node.style.display = 'initial';
		document.body.style.overflowY = 'hidden';
		this.emit('show');
	}
	hide() {
		if(!this.isShown) return;
		var cancelEvent = { cancel: false };
		this.emit('hiding', cancelEvent);
		if(cancelEvent.cancel) return;
		this.isShown = false;
		this.node.style.display = 'none';
		document.body.style.overflowY = 'initial';	
		this.emit('hide');
	}
	render() {
	}

	static createModal(view) {
		var modal = new Modal();
		modal.mainView.appendChild(view.node);
		view.on('close', () => { modal.hide(); });
		document.body.appendChild(modal.node);
		return modal;
	}

	static showNotification(title, message) {
		var modal = new Modal();
		modal.mainView.appendChild(SV.el('h1', { innerHTML: title || '' }));
		modal.mainView.appendChild(SV.el('p', { innerHTML: message || '' }));
		modal.mainView.appendChild(SV.el('div', { innerHTML: 'Ok', className: 'btn',
	       		events: { click: () => { modal.hide(); }}}));
		document.body.appendChild(modal.node);
		modal.show();
	}

	static confirm(title, message, callback) {
		var modal = new Modal();
		modal.mainView.appendChild(SV.el('h1', { innerHTML: title }));
		modal.mainView.appendChild(SV.el('p', { innerHTML: message }));
		modal.mainView.appendChild(SV.iconButton('done', { className: 'btn btn-big',
	       		events: { click: () => { modal.hide(); callback(); }}}));
		modal.mainView.appendChild(SV.el('div', { innerHTML: 'Cancel', className: 'btn btn-big',
	       		events: { click: () => { modal.hide(); }}}));
		document.body.appendChild(modal.node);
		modal.show();
	}

}

class Tab extends SyncView {
	constructor() {
		super();

		this.node.style.padding = '1em';
		this.node.style.boxShadow = '3px 3px 3px #555';
		this.node.style.backgroundColor = '#FFF';
	}
}

class TabView extends SyncView {
	constructor() {
		super();

		this.node.style.minWidth = '300px';

		this.header = SV.el('div', { parent: this.node, 
			style: { 
				minHeight: '1em',
				position: 'relative',
				top: '1px',
			}
		});


		this.tabs = [];
		this.tabsContainer = SV.el('div', { parent: this.node, 
			style: { 
				minHeight: '1em',
				border: '1px solid #000'
			}
		});
	}
	addTab(tab) {
		var headerButton = SV.el('div', { parent: this.header, innerHTML: tab.title,
			events: { click: () => { this.showTab(tab); }},
	      		style: { 
				border: '1px solid #555',
		    		borderBottom: '1px solid #000',
		    		display: 'inline-block',
		    		padding: '.25em',
		    		backgroundColor: '#DDD',
		    		height: '1em'
		    	}
		});
		tab.node.classList.add('hide');
		this.tabsContainer.appendChild(tab.node);
		this.tabs.push({ header: headerButton, tab: tab });
	}
	showTab(tab) {
		this.tabs.forEach((tabObj) => {
			if(tabObj.tab === tab) {
				tabObj.tab.node.classList.remove('hide');
				tabObj.header.style.border = '1px solid #000';
				tabObj.header.style.borderBottom = '1px solid #FFF';
		    		tabObj.header.style.backgroundColor = '#FFF';
			} else {
				tabObj.tab.node.classList.add('hide');
				tabObj.header.style.border = '1px solid #555';
				tabObj.header.style.borderBottom = 'initial';
		    		tabObj.header.style.backgroundColor = '#DDD';
			}
		});
	}
}

class SearchBox extends SyncView {
	constructor(options) {
		super();

		this.options = options || {};

		this.searchForm = SV.el('form', {
			parent: this.node,
			events: { submit: (e) => { 
				if(this.options.submitCB) {
					this.options.submitCB(this.searchInput.value); 
				}
				e.preventDefault(); 
			}}});
		this.searchInput = SV.el('input', { parent: this.searchForm,
			style: { width: 'calc(100% - 85px)', fontSize: '2em' } });
		this.submitButton = SV.el('input', { parent: this.searchForm, type: 'submit', value: this.options.buttonText || 'Go',
			style: { width: '80px', fontSize: '2em' } });
	}
	clear() {
		this.searchInput.value = '';
	}
	render() {
	}
}


class ImageUploader extends SyncView {
	constructor(maxSize) {
		super();
	
		this.maxSize = maxSize | 640;

		this.addInput = SV.el('input', {
			parent: this.node,
			type: 'file',
			accept: 'image/*',
			name: 'image',
			style: {
				display: 'none',
				fontSize: '1em',
				width: 'calc(100% - 4em)'
			},
			events: { change: () => { this.add(); }}});

		this.preview = SV.el('img', { 
			parent: this.node,
			style: { width: '100%' }, 
		        events: { click: () => { this.addInput.click(); },
		       		error: (e) => { e.target.src = '/imgs/no_image.png'; }
		        }});
	}
	static src(key) {
		var k = key.replace(/:/g, '_');
		k = k.replace(/\./g, '_');
		return k;
	}
	add() {
		this.uploadPhotos(this.addInput.files[0]);
	}	
	reloadPreview() {
		this.preview.src = this.data.image ? '/images/' + this.data.image + '?' + Date.now() : '/imgs/no_image.png';
	}
	render() {
		this.reloadPreview();
	}
	uploadPhotos(file){

		// Ensure it's an image
		if(file.type.match(/image.*/)) {
			console.log('An image has been loaded');

			// Load the image
			var reader = new FileReader();
			reader.onload = (readerEvent) => {
				var image = new Image();
				image.onload = (imageEvent) => {

					// Resize the image
					var canvas = document.createElement('canvas'),
					    width = image.width,
					    height = image.height;
					if (width > height) {
						if (width > this.maxSize) {
							height *= this.maxSize / width;
							width = this.maxSize;
						}
					} else {
						if (height > this.maxSize) {
							width *= this.maxSize / height;
							height = this.maxSize;
						}
					}
					canvas.width = width;
					canvas.height = height;
					canvas.getContext('2d').drawImage(image, 0, 0, width, height);
					var dataUrl = canvas.toDataURL('image/jpeg');
					var resizedImage = this.dataURLToBlob(dataUrl);

					var form = new FormData();
					form.append('destination', ImageUploader.src(this.data.key));
					form.append('image', resizedImage);					
					var xhr = new XMLHttpRequest();
					xhr.open('POST', '/upload', true);
					xhr.responseType = 'text';
					xhr.onload = () => {
						if(xhr.readyState === xhr.DONE) {
							if(xhr.status === 200) {
								console.log('xhr.responseText', xhr.responseText);
								this.emit('uploaded', xhr.responseText);
							}
						}
					};
					xhr.send(form);	
				}
				image.src = readerEvent.target.result;
			}
			reader.readAsDataURL(file);
		}
	}


	/* Utility function to convert a canvas to a BLOB */
	dataURLToBlob(dataURL) {
		var BASE64_MARKER = ';base64,';
		if (dataURL.indexOf(BASE64_MARKER) == -1) {
			var parts = dataURL.split(',');
			var contentType = parts[0].split(':')[1];
			var raw = parts[1];

			return new Blob([raw], {type: contentType});
		}

		var parts = dataURL.split(BASE64_MARKER);
		var contentType = parts[0].split(':')[1];
		var raw = window.atob(parts[1]);
		var rawLength = raw.length;

		var uInt8Array = new Uint8Array(rawLength);

		for (var i = 0; i < rawLength; ++i) {
			uInt8Array[i] = raw.charCodeAt(i);
		}

		return new Blob([uInt8Array], {type: contentType});
	}

}

