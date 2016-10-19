"use strict";


class EventEmitter {
	constructor() {
		SyncNode.addNE(this, '__eventHandlers', {});
	}
	on(eventName, handler) {
		if(!this.__eventHandlers[eventName]) this.__eventHandlers[eventName] = {};
		this.__eventHandlers[eventName][handler] = handler;
	}
	emit(eventName) {
		var handlers = this.__eventHandlers[eventName] || {};
		var args = new Array(arguments.length-1);
		for(var i = 1; i < arguments.length; ++i) {
			args[i-1] = arguments[i];
		}
		Object.keys(handlers).forEach((key) => { handlers[key].apply(null, args); });
	}
}

var syncNodeIdCounterForDebugging = 0;
class SyncNode extends EventEmitter {
	constructor(obj, parent) {
		super();

		obj = obj || {};
		SyncNode.addNE(this, '__syncNodeId', syncNodeIdCounterForDebugging++);
		SyncNode.addNE(this, '__isUpdatesDisabled', false);
		SyncNode.addNE(this, 'parent', parent);

		Object.keys(obj).forEach((propName) => {
			var propValue = obj[propName];
			if (typeof propValue === 'object' && propValue != null) {
				if (!SyncNode.isSyncNode(propValue)) {
					propValue = new SyncNode(propValue);
				}

				SyncNode.addNE(propValue, 'parent', this);
				propValue.on('updated', this.createOnUpdated(propName));
			}
			this[propName] = propValue;
		});
	}
	createOnUpdated(propName) {
		return (updated, merge) => {				
			if(!this.__isUpdatesDisabled) {
				var newUpdated = this;
				var newMerge = {};
				newMerge[propName] = merge;
				if(updated.version) { 
					this.version = updated.version;
				} else {
					this.version = SyncNode.guidShort();
				}
				newMerge.version = this.version;
				this.emit('updated', newUpdated, newMerge);
			}
		}
	}
	static equals(obj1, obj2) {
		// use === to differentiate between undefined and null
		if(obj1 === null && obj2 === null) {
		 	return true;
		} else if((obj1 != null && obj2 == null) || (obj1 == null && obj2 != null)) {
			return false;	
		} else if(obj1 && obj2 && obj1.version && obj2.version) {
			return obj1.version === obj2.version;
		} else if(typeof obj1 !== 'object' && typeof obj2 !== 'object') {
			return obj1 === obj2;
		}
	
		return false;	
	}
	set(key, val) {
		var merge = {};
		var split = key.split('.');
		var curr = merge;
		for(var i = 0; i < split.length - 1; i++) {
			curr[split[i]] = {};
			curr = curr[split[i]];		
		}
		curr[split[split.length-1]] = val;
		var result = this.merge(merge);
		return this;
	}
	get(path) {
		if(!path) return this;
		return SyncNode.getHelper(this, path.split('.'));
	}
	static getHelper(obj, split) {
		var isObject = SyncNode.isObject(obj);
		if(split.length === 1) { 
			return isObject ? obj[split[0]] : null;
		}
		if(!isObject) return null;
		return SyncNode.getHelper(obj[split[0]], split.slice(1, split.length));
	}
	remove(key) {
		if(this.hasOwnProperty(key)) {
			this.merge({ '__remove': key });
		}
		return this;
	}
	static isObject(val) {
		return typeof val === 'object' && val != null;
	}
	static isSyncNode(val) {
		if(!SyncNode.isObject(val)) return false;
		var className = val.constructor.toString().match(/\w+/g)[1];
 		return className === 'SyncNode';
	}
	merge(merge) {
		var result = this.doMerge(merge);
		if(result.hasChanges) {
			this.emit('updated', this, result.merge);
		}
		return this;
	}
	doMerge(merge, disableUpdates) {
		var hasChanges = false;
		var isEmpty = false;
		var newMerge = {};
		Object.keys(merge).forEach((key) => {
			if(key === '__remove') {
				var propsToRemove = merge[key];
				if(!Array.isArray(propsToRemove) && typeof propsToRemove === 'string') {
					var arr = [];
				        arr.push(propsToRemove);
			       		propsToRemove = arr;	       
				}
				propsToRemove.forEach((prop) => {
					delete this[prop];
				});
				if(!disableUpdates) {
					this.version = SyncNode.guidShort();
					newMerge['__remove'] = propsToRemove;
					hasChanges = true;
				}
			} else {
				var currVal = this[key];
				var newVal = merge[key];
				if(!SyncNode.equals(currVal, newVal)) {
					if(!SyncNode.isObject(newVal)) {
						// at a leaf node of the merge
						// we already know they aren't equal, simply set the value
						this[key] = newVal;
						if(!disableUpdates) {
							this.version = SyncNode.guidShort();
							newMerge[key] = newVal;
							hasChanges = true;
						}
					} else {
						// about to merge an object, make sure currVal is a SyncNode	
						if(!SyncNode.isSyncNode(currVal)) {
							currVal = new SyncNode({}, this);	
						}
						
						currVal.on('updated', this.createOnUpdated(key));

						var result = currVal.doMerge(newVal, disableUpdates);
						if(typeof this[key] === 'undefined') {
							result.hasChanges = true;
						}
						this[key] = currVal;
						if(!disableUpdates && result.hasChanges) {
							if(typeof currVal.version === 'undefined') {
								currVal.version = SyncNode.guidShort();
							}
							this.version = currVal.version;
							newMerge[key] = result.merge;
							hasChanges = true;
						}
					}
				}
			}
		});
		if(!disableUpdates && hasChanges) {
			newMerge.version = this.version;
			return { hasChanges: true, merge: newMerge };
		} else {
			return { hasChanges: false, merge: newMerge };
		}
	}
	static addNE(obj, propName, value) {
		Object.defineProperty(obj, propName, {
			enumerable: false,
		configurable: true,
		writable: true,
		value: value
		});
	};

	static s4() {
		return Math.floor((1 + Math.random()) * 0x10000)
			.toString(16)
			.substring(1);
	}

	static guidShort() {
		return SyncNode.s4() + SyncNode.s4();
	}
	static guid() {
		return SyncNode.s4() + SyncNode.s4() + '-' + SyncNode.s4() + '-' + SyncNode.s4() + '-' +
			SyncNode.s4() + '-' + SyncNode.s4() + SyncNode.s4() + SyncNode.s4();
	}
}


class LocalSyncNode extends SyncNode  {
	constructor(id) {
		var data = JSON.parse(localStorage.getItem(id));
		super(data);
		this.on('updated', () => {
			localStorage.setItem(id, JSON.stringify(this));
		});
	}
}

